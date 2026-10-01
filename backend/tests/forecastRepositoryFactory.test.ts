import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Every test dynamically re-imports the factory module after
// vi.resetModules() because it holds mutable top-level state (`repository`,
// `readiness`) that must not leak between tests — env-driven selection
// behavior needs a fresh module instance per scenario.

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.FORECAST_DATA_SOURCE;
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('resolveDataSource', () => {
  it('honors an explicit FORECAST_DATA_SOURCE=csv', async () => {
    process.env.FORECAST_DATA_SOURCE = 'csv';
    const { resolveDataSource } = await freshFactory();
    expect(resolveDataSource()).toBe('csv');
  });

  it('honors an explicit FORECAST_DATA_SOURCE=postgres', async () => {
    process.env.FORECAST_DATA_SOURCE = 'postgres';
    const { resolveDataSource } = await freshFactory();
    expect(resolveDataSource()).toBe('postgres');
  });

  it('rejects an invalid FORECAST_DATA_SOURCE value', async () => {
    process.env.FORECAST_DATA_SOURCE = 'mysql';
    const { resolveDataSource } = await freshFactory();
    expect(() => resolveDataSource()).toThrow(/Invalid FORECAST_DATA_SOURCE/);
  });

  it('defaults to csv when nothing is configured (zero-config local dev)', async () => {
    const { resolveDataSource } = await freshFactory();
    expect(resolveDataSource()).toBe('csv');
  });

  it('defaults to postgres when DATABASE_URL is set but FORECAST_DATA_SOURCE is not', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/whatever';
    const { resolveDataSource } = await freshFactory();
    expect(resolveDataSource()).toBe('postgres');
  });
});

describe('getForecastRepository (lazy csv path)', () => {
  it('constructs a CsvForecastRepository on demand without requiring initializeForecastRepository() first', async () => {
    process.env.FORECAST_DATA_SOURCE = 'csv';
    const { getForecastRepository } = await freshFactory();
    expect(() => getForecastRepository()).not.toThrow();
  });

  it('throws (never silently falls back to csv) when postgres is configured but never initialized', async () => {
    process.env.FORECAST_DATA_SOURCE = 'postgres';
    const { getForecastRepository } = await freshFactory();
    expect(() => getForecastRepository()).toThrow(/not initialized/);
  });
});

describe('initializeForecastRepository (postgres, unreachable database)', () => {
  it('leaves readiness in a failed state — never a silent CSV fallback — when the pool cannot connect', async () => {
    process.env.FORECAST_DATA_SOURCE = 'postgres';
    // Port 1 is a reserved/unlikely-to-be-listening port — this exercises a
    // real TCP connection failure (ECONNREFUSED-class error) through pg's
    // actual connection logic, rather than mocking pg's internals.
    process.env.DATABASE_URL = 'postgresql://localhost:1/definitely_not_running';
    const { initializeForecastRepository, getRepositoryReadinessState, getForecastRepository } = await freshFactory();

    await initializeForecastRepository();

    const state = getRepositoryReadinessState();
    expect(state.status).toBe('failed');
    expect(state.source).toBe('postgres');

    // getForecastRepository() still returns *a* repository instance here
    // (PostgresForecastRepository was constructed before the connection
    // check ran) — but readiness stays 'failed', so app.ts's gating
    // middleware blocks every route regardless of what this returns. The
    // critical guarantee is readiness, not this call throwing.
    expect(() => getForecastRepository()).not.toThrow();
  });
});

async function freshFactory() {
  vi.resetModules();
  return import('../src/repositories/forecastRepositoryFactory.js');
}
