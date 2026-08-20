import { beforeEach, describe, expect, it, vi } from 'vitest';

// Query-building/parameterization tests only — no live Postgres. pg.Pool is
// mocked at the pgPool.ts boundary so we can assert exactly what SQL text
// and bound parameters PostgresForecastRepository sends, without needing a
// real database connection.

const queryMock = vi.fn();

vi.mock('../src/lib/pgPool.js', () => ({
  getPool: () => ({ query: queryMock }),
}));

const { PostgresForecastRepository } = await import('../src/repositories/postgresForecastRepository.js');

beforeEach(() => {
  queryMock.mockReset();
  queryMock.mockResolvedValue({ rows: [] });
});

describe('PostgresForecastRepository.getLatest', () => {
  it('binds every user-supplied value as a parameter, never string-interpolated into the SQL text', async () => {
    const repo = new PostgresForecastRepository();
    await repo.getLatest("Tomato'; DROP TABLE price_forecasts; --", 'Telangana', 'Warangal', 'Warangal');

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];

    // The raw injection payload must appear ONLY in the params array, never
    // spliced into the query text itself.
    expect(sql).not.toContain('DROP TABLE');
    expect(sql).toContain('$1');
    expect(sql).toContain('$2');
    expect(sql).toContain('$3');
    expect(sql).toContain('$4');
    expect(params).toEqual(["Tomato'; DROP TABLE price_forecasts; --", 'Telangana', 'Warangal', 'Warangal']);
  });

  it('returns null when no row matches', async () => {
    const repo = new PostgresForecastRepository();
    const result = await repo.getLatest('Tomato', 'Telangana', 'Warangal', 'Warangal');
    expect(result).toBeNull();
  });

  it('maps a returned row into the ForecastRecord shape, converting NUMERIC strings to numbers', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          commodity: 'Tomato',
          state: 'Telangana',
          district: 'Warangal',
          market: 'Warangal',
          date: '2026-08-01',
          current_modal_price: '1200.50',
          predicted_price_trend: 'Rising',
          confidence: '0.8200',
          confidence_band: 'High',
          price_trend_score: '0.6400',
          prob_falling: '0.1000',
          prob_rising: '0.8200',
          prob_stable: '0.0800',
          id: '42',
        },
      ],
    });
    const repo = new PostgresForecastRepository();
    const result = await repo.getLatest('Tomato', 'Telangana', 'Warangal', 'Warangal');
    expect(result).toMatchObject({
      commodity: 'Tomato',
      currentModalPrice: 1200.5,
      confidence: 0.82,
      predictedPriceTrend: 'Rising',
    });
    expect(typeof result?.currentModalPrice).toBe('number');
  });
});

describe('PostgresForecastRepository.getAllLatest', () => {
  it('passes NULL (not empty string) for omitted optional filters, so SQL "IS NULL" checks apply', async () => {
    const repo = new PostgresForecastRepository();
    await repo.getAllLatest();

    const [, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual([null, null, null]);
  });

  it('caps results with an explicit LIMIT clause', async () => {
    const repo = new PostgresForecastRepository();
    await repo.getAllLatest('Tomato');
    const [sql] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/LIMIT \d+/);
  });
});

describe('PostgresForecastRepository.getYearlyHistory', () => {
  it('bounds the query to the requested calendar year via a date range (enables partition pruning)', async () => {
    const repo = new PostgresForecastRepository();
    await repo.getYearlyHistory('Tomato', 'Telangana', 'Warangal', 'Warangal', 2025);

    const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('observation_date >=');
    expect(sql).toContain('observation_date <');
    expect(params).toEqual(['Tomato', 'Telangana', 'Warangal', 'Warangal', '2025-01-01', '2026-01-01']);
  });
});

describe('PostgresForecastRepository.compareYears', () => {
  it('reports a year with no rows as hasData: false rather than fabricating zeros', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const repo = new PostgresForecastRepository();
    const result = await repo.compareYears('Tomato', 'Telangana', 'Warangal', 'Warangal', [2023, 2025]);

    expect(result).toHaveLength(2);
    for (const entry of result) {
      expect(entry.hasData).toBe(false);
      expect(entry.recordCount).toBe(0);
      expect(entry.latestRecord).toBeNull();
      expect(entry.minModalPrice).toBeNull();
    }
  });
});
