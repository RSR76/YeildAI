/**
 * Real-database integration tests for PostgresForecastRepository — unlike
 * postgresForecastRepository.test.ts (mocked pg.Pool), these run actual SQL
 * against a live PostgreSQL instance.
 *
 * Automatically skipped when DATABASE_URL is not set (default for every
 * other developer/CI run, since no live Postgres is assumed available) —
 * this file only activates when run against the disposable Telangana dev
 * database used for this migration's live verification. It must never be
 * pointed at production.
 */
import 'dotenv/config';
import { afterAll, describe, expect, it } from 'vitest';
import { PostgresForecastRepository } from '../src/repositories/postgresForecastRepository.js';
import { closePool } from '../src/lib/pgPool.js';

const hasLiveDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasLiveDb)('PostgresForecastRepository (live database integration)', () => {
  const repo = new PostgresForecastRepository();

  afterAll(async () => {
    await closePool();
  });

  it('listAvailableYears returns exactly the real ingested years for Tomato at Warangal', async () => {
    // 2024 was legitimately backfilled into this shared dev database
    // alongside the pre-existing 2025 data — see
    // docs/TELANGANA_2024_DATA_VALIDATION.md and the ingest run that
    // populated market_prices_2024. This is no longer [2025] only.
    const years = await repo.listAvailableYears('Tomato', 'Telangana', 'Warangal', 'Warangal');
    expect(years).toEqual([2024, 2025]);
  });

  it('getYearlyHistory returns real Warangal Tomato records for 2025, correctly partition-pruned', async () => {
    const result = await repo.getYearlyHistory('Tomato', 'Telangana', 'Warangal', 'Warangal', 2025);
    expect(result.year).toBe(2025);
    expect(result.records.length).toBeGreaterThan(0);
    for (const record of result.records) {
      expect(record.date.startsWith('2025')).toBe(true);
      expect(record.modalPrice).toBeGreaterThan(0);
    }
  });

  it('compareYears reports a genuinely missing year (2023) honestly, never fabricating data, while both real ingested years (2024, 2025) show real data', async () => {
    // 2023 is genuinely absent from market_prices for this (commodity,
    // market) — no 2023 data has ever been ingested — so it's still a valid
    // "honestly missing" case, unlike 2024 which is now real (see above).
    const comparison = await repo.compareYears('Tomato', 'Telangana', 'Warangal', 'Warangal', [2023, 2024, 2025]);
    const y2023 = comparison.find((c) => c.year === 2023);
    const y2024 = comparison.find((c) => c.year === 2024);
    const y2025 = comparison.find((c) => c.year === 2025);

    expect(y2023).toMatchObject({ hasData: false, recordCount: 0, latestRecord: null, minModalPrice: null, maxModalPrice: null, avgModalPrice: null });

    expect(y2024?.hasData).toBe(true);
    expect(y2024?.recordCount).toBeGreaterThan(0);
    expect(y2024?.minModalPrice).toBeLessThanOrEqual(y2024!.maxModalPrice!);

    expect(y2025?.hasData).toBe(true);
    expect(y2025?.recordCount).toBeGreaterThan(0);
    expect(y2025?.minModalPrice).toBeLessThanOrEqual(y2025!.maxModalPrice!);
  });

  it('getLatest reads back the real persisted model prediction for Tomato at Warangal', async () => {
    const forecast = await repo.getLatest('Tomato', 'Telangana', 'Warangal', 'Warangal');
    expect(forecast).not.toBeNull();
    expect(forecast?.predictedPriceTrend).toBe('Falling');
    expect(forecast?.currentModalPrice).toBe(1800);
    expect(forecast?.confidenceBand).toBe('Low');
  });

  it('returns null (never throws or crashes) for a location/commodity with no data', async () => {
    const forecast = await repo.getLatest('NoSuchCommodity', 'Telangana', 'NoSuchDistrict', 'NoSuchMarket');
    expect(forecast).toBeNull();
  });

  it('is safe against SQL-injection-shaped input against a REAL database, not just a mock', async () => {
    const maliciousCommodity = "Tomato'; DROP TABLE market_prices; --";
    const years = await repo.listAvailableYears(maliciousCommodity, 'Telangana', 'Warangal', 'Warangal');
    expect(years).toEqual([]);

    // Prove the table still exists and still has real data — the injection did nothing.
    const realYears = await repo.listAvailableYears('Tomato', 'Telangana', 'Warangal', 'Warangal');
    expect(realYears).toEqual([2024, 2025]);
  });

  it('listAvailableLocations reflects real seeded/ingested Telangana districts', async () => {
    const locations = await repo.listAvailableLocations();
    const districtNames = locations.map((l) => l.district).sort();
    expect(districtNames).toContain('Warangal');
    expect(districtNames).toContain('Karimnagar');
    for (const loc of locations) {
      expect(loc.state).toBe('Telangana');
    }
  });
});
