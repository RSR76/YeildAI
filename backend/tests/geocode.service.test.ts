import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as csvForecastIndex from '../src/lib/csvForecastIndex.js';
import {
  GeocodeUpstreamError,
  __clearGeocodeCacheForTests,
  __setRateLimitIntervalMsForTests,
  matchSupportedLocation,
  reverseGeocode,
} from '../src/services/geocode.service.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(here, 'fixtures/sample_lookup.csv');

// Fixture's distinct (state, district) pairs: (Uttar Pradesh, Barabanki),
// (Maharashtra, Nashik), (Haryana, Karnal) — see sample_lookup.csv.
beforeAll(() => {
  csvForecastIndex.__resetForTests(fixturePath);
  // Real Nominatim spacing (1.1s) would make this suite slow for no benefit
  // — tests exercise the rate limiter's own logic separately (below).
  __setRateLimitIntervalMsForTests(0);
});

beforeEach(() => {
  __clearGeocodeCacheForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetchOnce(response: { ok: boolean; status?: number; json?: () => Promise<unknown> }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: response.json ?? (() => Promise.resolve({})),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('reverseGeocode', () => {
  it('produces normalized, matched data for valid coordinates with a supported state/district', async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          display_name: 'Barabanki, Uttar Pradesh, India',
          address: { district: 'Barabanki', state: 'Uttar Pradesh', country: 'India' },
        }),
    });

    const result = await reverseGeocode(26.9339, 81.1956);

    expect(result).toEqual({
      latitude: 26.9339,
      longitude: 81.1956,
      displayName: 'Barabanki, Uttar Pradesh, India',
      state: 'Uttar Pradesh',
      district: 'Barabanki',
      country: 'India',
      source: 'nominatim',
      matchedState: 'Uttar Pradesh',
      matchedDistrict: 'Barabanki',
      isSupportedLocation: true,
    });

    // The upstream host/path is a fixed constant — never derived from
    // caller-supplied data — and the query string carries only the
    // validated lat/lon, nothing else.
    const requestedUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(requestedUrl.startsWith('https://nominatim.openstreetmap.org/reverse?')).toBe(true);
    expect(requestedUrl).toContain('lat=26.9339');
    expect(requestedUrl).toContain('lon=81.1956');
    expect(requestedUrl).toContain('accept-language=en');
  });

  it('sends an identifying User-Agent header', async () => {
    const fetchMock = mockFetchOnce({ ok: true, json: () => Promise.resolve({}) });
    await reverseGeocode(1, 1);
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((requestInit.headers as Record<string, string>)['User-Agent']).toContain('YieldAI');
  });

  it('requests English display names via both the accept-language query param and the Accept-Language header', async () => {
    const fetchMock = mockFetchOnce({ ok: true, json: () => Promise.resolve({}) });
    await reverseGeocode(1, 1);

    const requestedUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(requestedUrl).toContain('accept-language=en');

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((requestInit.headers as Record<string, string>)['Accept-Language']).toBe('en');
  });

  it('resolves district via the fallback field priority when "district" is absent', async () => {
    mockFetchOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          address: { state: 'Maharashtra', county: 'Nashik' },
        }),
    });

    const result = await reverseGeocode(20, 74);
    expect(result.district).toBe('Nashik');
    expect(result.isSupportedLocation).toBe(true);
    expect(result.matchedDistrict).toBe('Nashik');
  });

  it('handles a valid response with no address (e.g. ocean coordinates) without fabricating a match', async () => {
    mockFetchOnce({ ok: true, json: () => Promise.resolve({}) });

    const result = await reverseGeocode(0, 0);
    expect(result.state).toBeNull();
    expect(result.district).toBeNull();
    expect(result.isSupportedLocation).toBe(false);
    expect(result.matchedState).toBeNull();
    expect(result.matchedDistrict).toBeNull();
  });

  it('normalizes state comparison case/whitespace-insensitively', async () => {
    mockFetchOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          address: { state: '  uttar   pradesh  ', district: 'barabanki' },
        }),
    });

    const result = await reverseGeocode(26.9, 81.1);
    expect(result.matchedState).toBe('Uttar Pradesh');
    expect(result.matchedDistrict).toBe('Barabanki');
    expect(result.isSupportedLocation).toBe(true);
  });

  it('represents an unsupported state clearly, without changing the current selection', async () => {
    mockFetchOnce({
      ok: true,
      json: () => Promise.resolve({ address: { state: 'Kerala', district: 'Kochi' } }),
    });

    const result = await reverseGeocode(9.9, 76.3);
    expect(result.isSupportedLocation).toBe(false);
    expect(result.matchedState).toBeNull();
    expect(result.matchedDistrict).toBeNull();
    // The resolved (but unsupported) place is still surfaced for display.
    expect(result.state).toBe('Kerala');
    expect(result.district).toBe('Kochi');
  });

  it('produces a state-only match without inventing a district', async () => {
    mockFetchOnce({
      ok: true,
      json: () => Promise.resolve({ address: { state: 'Uttar Pradesh', district: 'Some Other District' } }),
    });

    const result = await reverseGeocode(27, 81);
    expect(result.matchedState).toBe('Uttar Pradesh');
    expect(result.matchedDistrict).toBeNull();
    expect(result.isSupportedLocation).toBe(false);
  });

  it('throws a controlled "timeout" error on an aborted request', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    await expect(reverseGeocode(1, 1)).rejects.toMatchObject({ code: 'timeout' });
    await expect(reverseGeocode(2, 2)).rejects.toBeInstanceOf(GeocodeUpstreamError);
  });

  it('throws a controlled "network" error on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(reverseGeocode(3, 3)).rejects.toMatchObject({ code: 'network' });
  });

  it('throws a controlled "upstream_error" on a non-2xx upstream response', async () => {
    mockFetchOnce({ ok: false, status: 503 });
    await expect(reverseGeocode(4, 4)).rejects.toMatchObject({ code: 'upstream_error' });
  });

  it('throws a controlled "invalid_response" error when the upstream body is not valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.reject(new Error('unexpected token')) })
    );
    await expect(reverseGeocode(5, 5)).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('caches results by rounded coordinates, avoiding a second upstream call', async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      json: () => Promise.resolve({ address: { state: 'Haryana', district: 'Karnal' } }),
    });

    const first = await reverseGeocode(29.6857, 76.9905);
    const second = await reverseGeocode(29.68571, 76.99049); // rounds to the same cache key

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });
});

describe('matchSupportedLocation', () => {
  const supported = [
    { state: 'Uttar Pradesh', district: 'Barabanki' },
    { state: 'Maharashtra', district: 'Nashik' },
  ];

  it('returns no match when the state is unresolved', () => {
    expect(matchSupportedLocation(null, 'Barabanki', supported)).toEqual({
      matchedState: null,
      matchedDistrict: null,
      isSupportedLocation: false,
    });
  });

  it('returns a state-only match when the district is unresolved', () => {
    expect(matchSupportedLocation('Uttar Pradesh', null, supported)).toEqual({
      matchedState: 'Uttar Pradesh',
      matchedDistrict: null,
      isSupportedLocation: false,
    });
  });
});

describe('outbound Nominatim rate limiting', () => {
  afterEach(() => {
    __setRateLimitIntervalMsForTests(0);
  });

  it('spaces concurrent uncached requests at least minIntervalMs apart', async () => {
    __setRateLimitIntervalMsForTests(50);
    const callTimes: number[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        callTimes.push(Date.now());
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
      })
    );

    // Three distinct (uncacheable) coordinates fired concurrently.
    await Promise.all([reverseGeocode(17.1, 79.1), reverseGeocode(17.2, 79.2), reverseGeocode(17.3, 79.3)]);

    expect(callTimes).toHaveLength(3);
    expect(callTimes[1]! - callTimes[0]!).toBeGreaterThanOrEqual(45);
    expect(callTimes[2]! - callTimes[1]!).toBeGreaterThanOrEqual(45);
  });
});
