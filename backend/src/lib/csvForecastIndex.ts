/**
 * CSV-backed forecast provider.
 *
 * Serves forecasts from data/forecast_lookup_all_commodities.csv, which is
 * genuine PRECOMPUTED OUTPUT from an already-trained RandomForestClassifier
 * (see ~/Yieldmodelling/notebooks/forecasting_model_multi_commodity.py for
 * the training code). This module does not run or load the model itself —
 * it only reads the model's saved predictions off disk, the same way
 * get_forecast_multi_commodity.py does.
 *
 * Memory design: the file has ~1.39M rows but only ~17,768 unique
 * (commodity, state, district, market) combinations, and each combination's
 * rows are contiguous in the file (verified empirically, not assumed). So
 * instead of parsing all 1.39M rows into JS objects, a single startup pass
 * builds two small structures:
 *   - latestByKey: one compact record per combination (~17k entries)
 *   - rangeByKey: a [startByteOffset, endByteOffset) pair per combination
 * Full price history for a single combination is read on demand directly
 * from its byte range on disk, so the 228MB file is never fully resident
 * in memory (steady-state footprint is on the order of ~10-20MB).
 *
 * This is a swappable local provider: when a real PostgreSQL DATABASE_URL
 * is available, forecast.service.ts / recommendation.service.ts can go back
 * to querying Prisma directly (that code path is untouched and still there).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ForecastRecord {
  id: string;
  commodity: string;
  state: string;
  district: string;
  market: string;
  date: string;
  currentModalPrice: number;
  predictedPriceTrend: string;
  confidence: number;
  confidenceBand: string;
  priceTrendScore: number;
  probFalling: number;
  probRising: number;
  probStable: number;
}

const REQUIRED_COLUMNS = [
  'commodity',
  'state',
  'district',
  'market',
  'date',
  'current_modal_price',
  'predicted_price_trend',
  'confidence',
  'confidence_band',
  'price_trend_score',
  'prob_Falling',
  'prob_Rising',
  'prob_Stable',
] as const;

function resolveCsvPath(): string {
  if (process.env.FORECAST_CSV_PATH) return process.env.FORECAST_CSV_PATH;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, '../../../data/forecast_lookup_all_commodities.csv'), // backend/src/lib -> repo root
    path.resolve(here, '../../data/forecast_lookup_all_commodities.csv'), // dist/lib -> repo root
    path.resolve(here, '../../../../data/forecast_lookup_all_commodities.csv'), // dist/src/lib -> repo root
  ] as const;
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function stripCR(buf: Buffer): Buffer {
  if (buf.length > 0 && buf[buf.length - 1] === 0x0d) return buf.subarray(0, buf.length - 1);
  return buf;
}

/** RFC4180-ish single-line CSV field splitter (handles quoted fields with embedded commas/quotes). */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function makeKey(commodity: string, state: string, district: string, market: string): string {
  return `${commodity.trim().toLowerCase()}|${state.trim().toLowerCase()}|${district.trim().toLowerCase()}|${market.trim().toLowerCase()}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface RowFields {
  commodity: string;
  state: string;
  district: string;
  market: string;
  date: string;
  current_modal_price: string;
  predicted_price_trend: string;
  confidence: string;
  confidence_band: string;
  price_trend_score: string;
  prob_Falling: string;
  prob_Rising: string;
  prob_Stable: string;
}

function fieldsToRecord(f: RowFields, key: string): ForecastRecord {
  return {
    id: `${key}::${f.date}`,
    commodity: f.commodity,
    state: f.state,
    district: f.district,
    market: f.market,
    date: f.date,
    currentModalPrice: round2(parseFloat(f.current_modal_price)),
    predictedPriceTrend: f.predicted_price_trend,
    confidence: round2(parseFloat(f.confidence)),
    confidenceBand: f.confidence_band,
    priceTrendScore: round2(parseFloat(f.price_trend_score)),
    probFalling: round2(parseFloat(f.prob_Falling)),
    probRising: round2(parseFloat(f.prob_Rising)),
    probStable: round2(parseFloat(f.prob_Stable)),
  };
}

interface BuiltIndex {
  csvPath: string;
  headerCols: string[];
  latestByKey: Map<string, ForecastRecord>;
  rangeByKey: Map<string, [number, number]>;
  commodities: string[];
}

function buildIndex(csvPath: string): BuiltIndex {
  if (!fs.existsSync(csvPath)) {
    throw new Error(
      `Forecast CSV not found at ${csvPath}. Copy the real forecast_lookup_all_commodities.csv into data/, ` +
        `or set FORECAST_CSV_PATH to its location.`
    );
  }

  const fd = fs.openSync(csvPath, 'r');
  const totalSize = fs.fstatSync(fd).size;

  const latestByKey = new Map<string, ForecastRecord>();
  const rangeByKey = new Map<string, [number, number]>();
  const commoditiesSet = new Set<string>();

  let headerCols: string[] = [];
  let isHeader = true;
  let leftover = Buffer.alloc(0);
  let filePos = 0;

  const CHUNK = 1 << 20; // 1MB
  const readBuf = Buffer.alloc(CHUNK);

  function processLine(lineBuf: Buffer, lineStart: number, lineEndExclusive: number) {
    if (isHeader) {
      headerCols = parseCsvLine(stripCR(lineBuf).toString('utf8'));
      const missing = REQUIRED_COLUMNS.filter((c) => !headerCols.includes(c));
      if (missing.length > 0) {
        throw new Error(`Forecast CSV at ${csvPath} is missing expected columns: ${missing.join(', ')}`);
      }
      isHeader = false;
      return;
    }
    if (lineBuf.length === 0) return;

    const values = parseCsvLine(stripCR(lineBuf).toString('utf8'));
    const row: Record<string, string> = {};
    for (let i = 0; i < headerCols.length; i++) {
      row[headerCols[i] as string] = values[i] ?? '';
    }
    const f = row as unknown as RowFields;
    const key = makeKey(f.commodity, f.state, f.district, f.market);

    const existingRange = rangeByKey.get(key);
    if (!existingRange) {
      rangeByKey.set(key, [lineStart, lineEndExclusive]);
    } else {
      existingRange[1] = lineEndExclusive;
    }

    // Rows for a given key are contiguous and ascending by date in file
    // order (verified against the real CSV), so the last row processed
    // for a key is always its latest forecast.
    latestByKey.set(key, fieldsToRecord(f, key));
    commoditiesSet.add(f.commodity);
  }

  while (filePos < totalSize) {
    const bytesRead = fs.readSync(fd, readBuf, 0, CHUNK, filePos);
    if (bytesRead <= 0) break;
    const chunk = leftover.length > 0 ? Buffer.concat([leftover, readBuf.subarray(0, bytesRead)]) : readBuf.subarray(0, bytesRead);
    const chunkStartOffset = filePos - leftover.length;
    filePos += bytesRead;

    let searchStart = 0;
    let nlIndex: number;
    while ((nlIndex = chunk.indexOf(0x0a, searchStart)) !== -1) {
      const lineStart = chunkStartOffset + searchStart;
      const lineEndExclusive = chunkStartOffset + nlIndex + 1;
      processLine(chunk.subarray(searchStart, nlIndex), lineStart, lineEndExclusive);
      searchStart = nlIndex + 1;
    }
    leftover = Buffer.from(chunk.subarray(searchStart));
  }
  if (leftover.length > 0) {
    processLine(leftover, totalSize - leftover.length, totalSize);
  }

  fs.closeSync(fd);

  return {
    csvPath,
    headerCols,
    latestByKey,
    rangeByKey,
    commodities: Array.from(commoditiesSet).sort((a, b) => a.localeCompare(b)),
  };
}

export type ReadinessState =
  | { status: 'initializing'; startedAt: number }
  | { status: 'ready'; startedAt: number; readyAt: number; commodityCount: number; locationCount: number }
  | { status: 'failed'; startedAt: number; error: string };

let cached: BuiltIndex | null = null;
let readiness: ReadinessState = { status: 'initializing', startedAt: Date.now() };

function countLocations(idx: BuiltIndex): number {
  const keys = new Set<string>();
  for (const record of idx.latestByKey.values()) {
    keys.add(`${record.state.trim().toLowerCase()}|${record.district.trim().toLowerCase()}|${record.market.trim().toLowerCase()}`);
  }
  return keys.size;
}

/**
 * No lazy fallback here on purpose: a request that reaches this function
 * before startup initialization has completed throws instead of silently
 * building the index inline. The only supported way to make the index
 * available is initializeForecastIndex() (production startup) or the
 * test-only hooks below — never an on-demand build triggered by a live
 * request, which would bypass the /ready gating in app.ts.
 */
function getIndex(): BuiltIndex {
  if (!cached) {
    throw new Error('Forecast index is not initialized. Call initializeForecastIndex() during startup before serving requests.');
  }
  return cached;
}

/**
 * Loads and prepares the forecast index during backend startup. Safe to call
 * once at process boot; updates the module's readiness state as it runs so
 * GET /ready and the request-gating middleware in app.ts can reflect it.
 */
export function initializeForecastIndex(): void {
  const csvPath = resolveCsvPath();
  const startedAt = Date.now();
  readiness = { status: 'initializing', startedAt };
  console.log(`[forecastIndex] csv path: ${csvPath}`);
  console.log('[forecastIndex] initialization starting');
  try {
    const built = buildIndex(csvPath);
    cached = built;
    const readyAt = Date.now();
    const commodityCount = built.commodities.length;
    const locationCount = countLocations(built);
    readiness = { status: 'ready', startedAt, readyAt, commodityCount, locationCount };
    console.log(
      `[forecastIndex] initialization complete in ${readyAt - startedAt}ms — commodities=${commodityCount} locations=${locationCount}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    readiness = { status: 'failed', startedAt, error: message };
    console.error(`[forecastIndex] initialization failed after ${Date.now() - startedAt}ms: ${message}`);
  }
}

export function getReadinessState(): ReadinessState {
  return readiness;
}

/**
 * Test-only hook: builds the index against a specific CSV path (or the
 * resolved default) and resets readiness back to a neutral 'initializing'
 * state — it does NOT mark the service ready. Tests that exercise the
 * app-level readiness gate must call __markReadyForTests() or
 * __setReadinessForTests() explicitly afterward; tests that only call the
 * exported getters/functions directly don't need readiness at all, since
 * those read from `cached` regardless of readiness state.
 */
export function __resetForTests(csvPath?: string): void {
  cached = buildIndex(csvPath ?? resolveCsvPath());
  readiness = { status: 'initializing', startedAt: Date.now() };
}

/** Test-only hook: marks the index built by __resetForTests as ready. */
export function __markReadyForTests(): void {
  if (!cached) {
    throw new Error('__markReadyForTests requires __resetForTests to be called first');
  }
  const now = Date.now();
  readiness = {
    status: 'ready',
    startedAt: now,
    readyAt: now,
    commodityCount: cached.commodities.length,
    locationCount: countLocations(cached),
  };
}

/** Test-only hook: forces an arbitrary readiness state, e.g. to test 'failed'. */
export function __setReadinessForTests(state: ReadinessState): void {
  readiness = state;
}

export function getLatestForecast(commodity: string, state: string, district: string, market: string): ForecastRecord | null {
  const idx = getIndex();
  const key = makeKey(commodity, state, district, market);
  return idx.latestByKey.get(key) ?? null;
}

export function getAllLatestForecasts(commodity?: string): ForecastRecord[] {
  const idx = getIndex();
  const all = Array.from(idx.latestByKey.values());
  if (!commodity) return all;
  const target = commodity.trim().toLowerCase();
  return all.filter((r) => r.commodity.trim().toLowerCase() === target);
}

export function listAvailableCommodities(): string[] {
  return getIndex().commodities;
}

export interface LocationOption {
  state: string;
  district: string;
}

/** Distinct (state, district) pairs across all commodities, for populating
 * location selectors without shipping the full per-market forecast list. */
export function listAvailableLocations(): LocationOption[] {
  const idx = getIndex();
  const byKey = new Map<string, LocationOption>();
  for (const record of idx.latestByKey.values()) {
    const key = `${record.state.trim().toLowerCase()}|${record.district.trim().toLowerCase()}`;
    if (!byKey.has(key)) byKey.set(key, { state: record.state, district: record.district });
  }
  return Array.from(byKey.values()).sort(
    (a, b) => a.state.localeCompare(b.state) || a.district.localeCompare(b.district)
  );
}

export function listAvailableMarkets(commodity?: string): Array<{ commodity: string; state: string; district: string; market: string }> {
  const idx = getIndex();
  const all = Array.from(idx.latestByKey.values());
  const filtered = commodity ? all.filter((r) => r.commodity.trim().toLowerCase() === commodity.trim().toLowerCase()) : all;
  return filtered.map((r) => ({ commodity: r.commodity, state: r.state, district: r.district, market: r.market }));
}

export function getPriceHistory(commodity: string, state: string, district: string, market: string): ForecastRecord[] {
  const idx = getIndex();
  const key = makeKey(commodity, state, district, market);
  const range = idx.rangeByKey.get(key);
  if (!range) return [];

  const [start, end] = range;
  const fd = fs.openSync(idx.csvPath, 'r');
  try {
    const length = end - start;
    const buf = Buffer.alloc(length);
    fs.readSync(fd, buf, 0, length, start);

    const records: ForecastRecord[] = [];
    let searchStart = 0;
    let nlIndex: number;
    while ((nlIndex = buf.indexOf(0x0a, searchStart)) !== -1) {
      appendRecord(buf.subarray(searchStart, nlIndex));
      searchStart = nlIndex + 1;
    }
    if (searchStart < buf.length) {
      appendRecord(buf.subarray(searchStart));
    }

    function appendRecord(lineBuf: Buffer) {
      if (lineBuf.length === 0) return;
      const values = parseCsvLine(stripCR(lineBuf).toString('utf8'));
      const row: Record<string, string> = {};
      for (let i = 0; i < idx.headerCols.length; i++) {
        row[idx.headerCols[i] as string] = values[i] ?? '';
      }
      records.push(fieldsToRecord(row as unknown as RowFields, key));
    }

    return records;
  } finally {
    fs.closeSync(fd);
  }
}
