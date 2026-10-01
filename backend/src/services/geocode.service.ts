/**
 * Reverse-geocoding service backed by OpenStreetMap Nominatim.
 *
 * Design constraints (see PR description / task spec for the full rationale):
 * - The upstream hostname is a fixed constant. Callers only ever supply a
 *   validated (lat, lon) pair — there is no code path that lets request
 *   input control which host gets requested.
 * - Every upstream failure mode (timeout, network error, non-2xx, invalid
 *   JSON) is normalized into a GeocodeUpstreamError with a small closed set
 *   of `code`s. Callers (the controller) map those to safe, non-technical
 *   messages — the raw upstream error/body never reaches the response.
 * - A small bounded, time-limited in-memory cache keyed by coordinates
 *   rounded to 3 decimal places (~110m) avoids repeat upstream calls for the
 *   same map click without needing persistent storage.
 * - Nominatim's public-instance usage policy caps sustained use at 1
 *   request/second, enforced against the whole calling application, not per
 *   user (see https://operations.osmfoundation.org/policies/nominatim/). A
 *   single user's clicks can't exceed that, but concurrent requests from
 *   multiple users could without a shared outbound limiter — see
 *   rateLimitedFetch below.
 */

import { z } from 'zod';
import { getForecastRepository } from '../repositories/forecastRepositoryFactory.js';
import type { LocationOption } from '../repositories/forecastRepository.js';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/reverse';
const REQUEST_TIMEOUT_MS = 5000;
const USER_AGENT = 'YieldAI/1.0 (agricultural recommendation demo; reverse-geocoding feature)';

const CACHE_MAX_ENTRIES = 200;
const CACHE_TTL_MS = 10 * 60 * 1000;

export type GeocodeErrorCode = 'timeout' | 'network' | 'upstream_error' | 'invalid_response';

export class GeocodeUpstreamError extends Error {
  readonly code: GeocodeErrorCode;

  constructor(code: GeocodeErrorCode, message: string) {
    super(message);
    this.name = 'GeocodeUpstreamError';
    this.code = code;
  }
}

// The upstream response is an external boundary like any other in this
// codebase (cf. the Zod-validated query params in geocode.controller.ts) —
// validated defensively rather than blindly cast, since Nominatim's `address`
// object shape isn't contractually guaranteed.
const nominatimAddressSchema = z
  .object({
    district: z.string().optional(),
    state_district: z.string().optional(),
    county: z.string().optional(),
    city_district: z.string().optional(),
    municipality: z.string().optional(),
    city: z.string().optional(),
    town: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
  })
  .loose();

const nominatimResponseSchema = z
  .object({
    display_name: z.string().optional(),
    address: nominatimAddressSchema.optional(),
  })
  .loose();

type NominatimAddress = z.infer<typeof nominatimAddressSchema>;
type NominatimResponse = z.infer<typeof nominatimResponseSchema>;

export interface ReverseGeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string | null;
  state: string | null;
  district: string | null;
  country: string | null;
  source: 'nominatim';
  matchedState: string | null;
  matchedDistrict: string | null;
  isSupportedLocation: boolean;
}

// Priority order for resolving a "district" out of Nominatim's inconsistent
// address fields — first non-empty field wins. Documented here because the
// field actually populated varies by region and Nominatim data source, and
// silently picking the wrong one (e.g. a city name) would misrepresent the
// resolved district.
const DISTRICT_FIELD_PRIORITY = [
  'district',
  'state_district',
  'county',
  'city_district',
  'municipality',
  'city',
  'town',
] as const;

function resolveDistrictField(address: NominatimAddress): string | null {
  for (const field of DISTRICT_FIELD_PRIORITY) {
    const value = address[field];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

/** Case/whitespace-insensitive comparison key, matching the normalization
 * style already used for location lookups elsewhere (trim + lowercase). */
function normalizeForCompare(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface SupportedLocationMatch {
  matchedState: string | null;
  matchedDistrict: string | null;
  isSupportedLocation: boolean;
}

/**
 * Compares a resolved (state, district) against the forecast dataset's
 * supported locations. Never fabricates a match: an unresolved state means
 * no match at all, and a resolved state with no matching district in that
 * state means a state-only match — the caller must not invent a district.
 */
export function matchSupportedLocation(
  resolvedState: string | null,
  resolvedDistrict: string | null,
  supportedLocations: LocationOption[]
): SupportedLocationMatch {
  if (!resolvedState) return { matchedState: null, matchedDistrict: null, isSupportedLocation: false };

  const normalizedState = normalizeForCompare(resolvedState);
  const stateMatch = supportedLocations.find((loc) => normalizeForCompare(loc.state) === normalizedState);
  if (!stateMatch) return { matchedState: null, matchedDistrict: null, isSupportedLocation: false };

  if (!resolvedDistrict) return { matchedState: stateMatch.state, matchedDistrict: null, isSupportedLocation: false };

  const normalizedDistrict = normalizeForCompare(resolvedDistrict);
  const districtMatch = supportedLocations.find(
    (loc) => normalizeForCompare(loc.state) === normalizedState && normalizeForCompare(loc.district) === normalizedDistrict
  );
  if (!districtMatch) return { matchedState: stateMatch.state, matchedDistrict: null, isSupportedLocation: false };

  return { matchedState: districtMatch.state, matchedDistrict: districtMatch.district, isSupportedLocation: true };
}

interface CacheEntry {
  result: ReverseGeocodeResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

// Serializes every outbound Nominatim call behind a minimum spacing so
// concurrent requests from different users can't collectively exceed the
// 1 req/sec public-instance policy. A single promise chain (not a token
// bucket) is enough at this call volume and keeps the logic trivial to
// reason about: each call waits for the previous one's slot, then waits out
// whatever's left of the minimum interval before firing.
let minIntervalMs = 1100;
let queueTail: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

function rateLimited<T>(fn: () => Promise<T>): Promise<T> {
  const run = queueTail.then(async () => {
    const wait = Math.max(0, minIntervalMs - (Date.now() - lastRequestAt));
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
  });
  queueTail = run.catch(() => {});
  return run.then(fn);
}

/** Test-only hook: shrinks (or removes) the outbound rate-limit spacing so tests don't pay real wall-clock delay. */
export function __setRateLimitIntervalMsForTests(ms: number): void {
  minIntervalMs = ms;
}

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

function getCached(key: string): ReverseGeocodeResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

function setCached(key: string, result: ReverseGeocodeResult): void {
  if (!cache.has(key) && cache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Test-only hook: clears the in-memory geocode cache between test cases. */
export function __clearGeocodeCacheForTests(): void {
  cache.clear();
}

async function fetchNominatim(lat: number, lon: number): Promise<NominatimResponse> {
  // Only validated numeric lat/lon ever reach the query string — the
  // upstream host/path above is a fixed literal, never derived from request
  // input, so there is no way for a caller to redirect this request.
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(lat),
    lon: String(lon),
    zoom: '10',
    addressdetails: '1',
    // Nominatim's documented query param for response language — fixed to
    // English so displayName/address fields are consistently in English.
    // Nominatim falls back to the place's local name when no English name
    // is recorded, which is the intentional "prefer English, fall back to
    // local" behavior rather than an error case.
    'accept-language': 'en',
  });
  const url = `${NOMINATIM_BASE_URL}?${params.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await rateLimited(() =>
      fetch(url, {
        // Accept-Language header as a second, standard-HTTP way of asking for
        // English — belt-and-suspenders with the accept-language query param
        // above, which is the mechanism Nominatim's own docs specify.
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', 'Accept-Language': 'en' },
        signal: controller.signal,
      })
    );
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new GeocodeUpstreamError('timeout', 'Reverse geocoding request timed out');
    }
    throw new GeocodeUpstreamError('network', 'Reverse geocoding request failed');
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new GeocodeUpstreamError('upstream_error', `Reverse geocoding upstream returned status ${response.status}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new GeocodeUpstreamError('invalid_response', 'Reverse geocoding upstream returned an invalid response');
  }

  const parsed = nominatimResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new GeocodeUpstreamError('invalid_response', 'Reverse geocoding upstream returned an unexpected response shape');
  }
  return parsed.data;
}

/**
 * Resolves a lat/lon to a place name and matches it against the forecast
 * dataset's supported (state, district) pairs. Only ever called after the
 * caller has already validated lat/lon are finite and in-range.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeocodeResult> {
  const key = cacheKey(lat, lon);
  const cached = getCached(key);
  if (cached) return cached;

  const upstream = await fetchNominatim(lat, lon);
  const address = upstream.address ?? {};

  const state = typeof address.state === 'string' && address.state.trim() ? address.state.trim() : null;
  const district = resolveDistrictField(address);
  const country = typeof address.country === 'string' && address.country.trim() ? address.country.trim() : null;
  const displayName = typeof upstream.display_name === 'string' && upstream.display_name.trim() ? upstream.display_name.trim() : null;

  const supportedLocations = await getForecastRepository().listAvailableLocations();
  const match = matchSupportedLocation(state, district, supportedLocations);

  const result: ReverseGeocodeResult = {
    latitude: lat,
    longitude: lon,
    displayName,
    state,
    district,
    country,
    source: 'nominatim',
    matchedState: match.matchedState,
    matchedDistrict: match.matchedDistrict,
    isSupportedLocation: match.isSupportedLocation,
  };

  setCached(key, result);
  return result;
}
