/**
 * Selects exactly ONE ForecastRepository implementation at process startup
 * and never changes it while the process is running — there is no
 * per-request fallback between Postgres and the CSV index. A production
 * database failure must surface as a real 503/readiness failure, not a
 * silent swap to stale CSV data (see docs/POSTGRES_FORECAST_MIGRATION_PLAN.md).
 *
 * Selection rule (FORECAST_DATA_SOURCE env var):
 *   - 'postgres'      -> PostgresForecastRepository. Startup fails (readiness
 *                        stays 'failed') if DATABASE_URL is missing or the
 *                        pool can't connect.
 *   - 'csv'            -> CsvForecastRepository (today's behavior, unchanged).
 *   - unset + DATABASE_URL set     -> defaults to 'postgres' (a configured
 *                        database is assumed intentional).
 *   - unset + no DATABASE_URL      -> defaults to 'csv' (keeps zero-config
 *                        local dev working exactly as before this migration).
 */

import { initializeForecastIndex, getReadinessState as getCsvReadinessState } from '../lib/csvForecastIndex.js';
import { checkPoolConnection } from '../lib/pgPool.js';
import { CsvForecastRepository } from './csvForecastRepository.js';
import { PostgresForecastRepository } from './postgresForecastRepository.js';
import type { ForecastRepository } from './forecastRepository.js';

export type ForecastDataSource = 'postgres' | 'csv';

export type RepositoryReadinessState =
  | { status: 'initializing'; startedAt: number; source: ForecastDataSource }
  | { status: 'ready'; startedAt: number; readyAt: number; source: ForecastDataSource }
  | { status: 'failed'; startedAt: number; source: ForecastDataSource; error: string };

let readiness: RepositoryReadinessState = { status: 'initializing', startedAt: Date.now(), source: 'csv' };
let repository: ForecastRepository | null = null;

export function resolveDataSource(): ForecastDataSource {
  const configured = process.env.FORECAST_DATA_SOURCE?.trim().toLowerCase();
  if (configured === 'postgres' || configured === 'csv') return configured;
  if (configured) {
    throw new Error(`Invalid FORECAST_DATA_SOURCE "${configured}" — must be "postgres" or "csv".`);
  }
  return process.env.DATABASE_URL ? 'postgres' : 'csv';
}

export async function initializeForecastRepository(): Promise<void> {
  const source = resolveDataSource();
  const startedAt = Date.now();
  readiness = { status: 'initializing', startedAt, source };
  console.log(`[forecastRepository] selected data source: ${source}`);

  if (source === 'csv') {
    repository = new CsvForecastRepository();
    // Reuses the existing synchronous CSV index build/readiness machinery
    // unchanged — this repository is a thin adapter over it (see
    // csvForecastRepository.ts), so its readiness IS the index's readiness.
    initializeForecastIndex();
    const csvState = getCsvReadinessState();
    readiness =
      csvState.status === 'ready'
        ? { status: 'ready', startedAt, readyAt: csvState.readyAt, source }
        : csvState.status === 'failed'
          ? { status: 'failed', startedAt, source, error: csvState.error }
          : { status: 'initializing', startedAt, source };
    return;
  }

  // source === 'postgres'
  repository = new PostgresForecastRepository();
  try {
    await checkPoolConnection();
    readiness = { status: 'ready', startedAt, readyAt: Date.now(), source };
    console.log(`[forecastRepository] Postgres connection verified — ready in ${Date.now() - startedAt}ms`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    readiness = { status: 'failed', startedAt, source, error: message };
    console.error(`[forecastRepository] Postgres connection failed: ${message}`);
    // Deliberately not falling back to CsvForecastRepository here — an
    // operator who set FORECAST_DATA_SOURCE=postgres asked for the database
    // to be authoritative; masking a DB outage with stale CSV data would be
    // the exact silent-fallback behavior the architecture explicitly forbids.
  }
}

/**
 * For the 'csv' source, this reflects csvForecastIndex's OWN live readiness
 * state on every call rather than a cached snapshot — csvForecastIndex owns
 * that state independently (including its test hooks,
 * __setReadinessForTests/__resetForTests/__markReadyForTests), and tests
 * that drive it directly without ever calling initializeForecastRepository()
 * must still see /ready and the gating middleware react immediately. For
 * 'postgres', the connection check in initializeForecastRepository() is the
 * only thing that sets readiness, so the cached snapshot is returned as-is.
 */
export function getRepositoryReadinessState(): RepositoryReadinessState {
  if (resolveDataSource() === 'csv') {
    const csvState = getCsvReadinessState();
    if (csvState.status === 'ready') {
      return { status: 'ready', startedAt: csvState.startedAt, readyAt: csvState.readyAt, source: 'csv' };
    }
    if (csvState.status === 'failed') {
      return { status: 'failed', startedAt: csvState.startedAt, source: 'csv', error: csvState.error };
    }
    return { status: 'initializing', startedAt: csvState.startedAt, source: 'csv' };
  }
  return readiness;
}

export function getForecastRepository(): ForecastRepository {
  if (repository) return repository;

  // CSV-backed access is stateless (csvForecastIndex.ts owns its own
  // module-level cache/readiness) and cheap to construct on demand, so
  // skipping initializeForecastRepository() entirely is safe for the 'csv'
  // path — this is what lets unit tests construct a service/controller
  // directly and drive csvForecastIndex.__resetForTests() themselves,
  // exactly like before this repository layer existed. The 'postgres' path
  // intentionally has no such shortcut: a missing pool must fail loudly,
  // never silently construct a repository whose connection was never
  // verified.
  if (resolveDataSource() === 'csv') {
    repository = new CsvForecastRepository();
    return repository;
  }

  throw new Error('Forecast repository is not initialized. Call initializeForecastRepository() during startup before serving requests.');
}

/** Test-only hook: injects a repository/readiness pair directly, bypassing env-based selection. */
export function __setRepositoryForTests(repo: ForecastRepository, state: RepositoryReadinessState): void {
  repository = repo;
  readiness = state;
}
