/**
 * Production-target ForecastRepository: queries the partitioned analytical
 * schema in backend/db/migrations/ via parameterized SQL (never
 * string-interpolated user input — every value below is bound as $1, $2...).
 *
 * Two fact tables back this repository, deliberately kept separate:
 *   - price_forecasts: model OUTPUT (trend/confidence/probabilities), one
 *     row per (model_run, market, commodity, reference_date). Backs
 *     getLatest/getAllLatest/getPriceHistory — anything the CSV-era
 *     ForecastRecord shape expects trend/confidence fields for.
 *   - market_prices: real historical price OBSERVATIONS ingested from
 *     government sources, no trend/confidence fields at all. Backs the
 *     year-aware methods (listAvailableYears/getYearlyHistory/compareYears)
 *     — this is what makes "genuine multi-year history", as opposed to
 *     forecast snapshots, queryable.
 *
 * Every query result set that could be unbounded carries an explicit LIMIT
 * (documented inline) rather than relying on callers to paginate.
 */

import type { PoolClient } from 'pg';
import { getPool } from '../lib/pgPool.js';
import type {
  ForecastRepository,
  ForecastRecord,
  LocationOption,
  MarketOption,
  PriceHistoryRecord,
  YearlyHistoryResult,
  YearComparisonEntry,
} from './forecastRepository.js';

// price_forecasts.confidence etc. are NUMERIC columns — node-postgres
// returns NUMERIC as a string by default (to avoid silent float precision
// loss on values the driver can't safely widen), so every numeric field
// read back from Postgres is explicitly converted here rather than trusted
// to already be a JS number.
function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

interface ForecastRow {
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
  prob_falling: string;
  prob_rising: string;
  prob_stable: string;
  id: string;
}

function mapForecastRow(row: ForecastRow): ForecastRecord {
  return {
    id: row.id,
    commodity: row.commodity,
    state: row.state,
    district: row.district,
    market: row.market,
    date: row.date,
    currentModalPrice: num(row.current_modal_price),
    predictedPriceTrend: row.predicted_price_trend,
    confidence: num(row.confidence),
    confidenceBand: row.confidence_band,
    priceTrendScore: num(row.price_trend_score),
    probFalling: num(row.prob_falling),
    probRising: num(row.prob_rising),
    probStable: num(row.prob_stable),
  };
}

interface PriceRow {
  id: string;
  commodity: string;
  state: string;
  district: string;
  market: string;
  date: string;
  modal_price: string;
  min_price: string | null;
  max_price: string | null;
  variety: string | null;
  grade: string | null;
  source: string;
}

function mapPriceRow(row: PriceRow): PriceHistoryRecord {
  return {
    id: row.id,
    commodity: row.commodity,
    state: row.state,
    district: row.district,
    market: row.market,
    date: row.date,
    modalPrice: num(row.modal_price),
    minPrice: numOrNull(row.min_price),
    maxPrice: numOrNull(row.max_price),
    variety: row.variety,
    grade: row.grade,
    source: row.source,
  };
}

const FORECAST_SELECT = `
  SELECT
    c.name AS commodity,
    s.name AS state,
    d.name AS district,
    m.name AS market,
    pf.reference_date::text AS date,
    pf.current_modal_price,
    pf.predicted_price_trend,
    pf.confidence,
    pf.confidence_band,
    pf.price_trend_score,
    pf.prob_falling,
    pf.prob_rising,
    pf.prob_stable,
    pf.id::text AS id
  FROM price_forecasts pf
  JOIN markets m ON m.id = pf.market_id
  JOIN districts d ON d.id = m.district_id
  JOIN states s ON s.id = d.state_id
  JOIN commodities c ON c.id = pf.commodity_id
`;

const PRICE_SELECT = `
  SELECT
    mp.id::text AS id,
    c.name AS commodity,
    s.name AS state,
    d.name AS district,
    m.name AS market,
    mp.observation_date::text AS date,
    mp.modal_price,
    mp.min_price,
    mp.max_price,
    mp.variety,
    mp.grade,
    mp.source
  FROM market_prices mp
  JOIN markets m ON m.id = mp.market_id
  JOIN districts d ON d.id = m.district_id
  JOIN states s ON s.id = d.state_id
  JOIN commodities c ON c.id = mp.commodity_id
`;

export class PostgresForecastRepository implements ForecastRepository {
  async getLatest(commodity: string, state: string, district: string, market: string): Promise<ForecastRecord | null> {
    const { rows } = await getPool().query<ForecastRow>(
      `${FORECAST_SELECT}
       WHERE lower(c.name) = lower($1) AND lower(s.name) = lower($2)
         AND lower(d.name) = lower($3) AND lower(m.name) = lower($4)
       ORDER BY pf.reference_date DESC, pf.created_at DESC
       LIMIT 1`,
      [commodity, state, district, market]
    );
    return rows[0] ? mapForecastRow(rows[0]) : null;
  }

  /**
   * Latest forecast per (market, commodity) combination, optionally filtered
   * by commodity and/or (state, district). DISTINCT ON requires its leading
   * columns to match ORDER BY's leading columns, which is why market_id and
   * commodity_id both appear first in ORDER BY even though callers only ever
   * sort by date in effect.
   *
   * LIMIT 5000: comfortably above the ~17.7k CSV-era (commodity, market)
   * combinations for ALL of India, and far above what a single supported
   * state needs — revisit with real pagination if a future multi-state
   * rollout approaches this bound (see docs/ARCHITECTURE_V2.md scaling notes).
   */
  async getAllLatest(commodity?: string, state?: string, district?: string): Promise<ForecastRecord[]> {
    const { rows } = await getPool().query<ForecastRow>(
      `SELECT * FROM (
         SELECT DISTINCT ON (pf.market_id, pf.commodity_id)
           c.name AS commodity, s.name AS state, d.name AS district, m.name AS market,
           pf.reference_date::text AS date, pf.current_modal_price, pf.predicted_price_trend,
           pf.confidence, pf.confidence_band, pf.price_trend_score,
           pf.prob_falling, pf.prob_rising, pf.prob_stable, pf.id::text AS id
         FROM price_forecasts pf
         JOIN markets m ON m.id = pf.market_id
         JOIN districts d ON d.id = m.district_id
         JOIN states s ON s.id = d.state_id
         JOIN commodities c ON c.id = pf.commodity_id
         WHERE ($1::text IS NULL OR lower(c.name) = lower($1))
           -- state/district is an optional *pair*, matching
           -- CsvForecastRepository/csvForecastIndex.getAllLatestForecasts and
           -- the allLatestQuerySchema.refine() at the HTTP boundary: passing
           -- only one would be ambiguous ("which district in which state?"),
           -- so the filter only ever applies when both are present together,
           -- never independently.
           AND (
             ($2::text IS NULL AND $3::text IS NULL)
             OR (lower(s.name) = lower($2) AND lower(d.name) = lower($3))
           )
         ORDER BY pf.market_id, pf.commodity_id, pf.reference_date DESC, pf.created_at DESC
       ) latest
       ORDER BY commodity, market
       LIMIT 5000`,
      [commodity ?? null, state ?? null, district ?? null]
    );
    return rows.map(mapForecastRow);
  }

  async listAvailableCommodities(): Promise<string[]> {
    const { rows } = await getPool().query<{ name: string }>(
      `SELECT DISTINCT c.name FROM commodities c
       JOIN price_forecasts pf ON pf.commodity_id = c.id
       ORDER BY c.name`
    );
    return rows.map((r) => r.name);
  }

  async listAvailableMarkets(commodity?: string): Promise<MarketOption[]> {
    const { rows } = await getPool().query<{ commodity: string; state: string; district: string; market: string }>(
      `SELECT DISTINCT c.name AS commodity, s.name AS state, d.name AS district, m.name AS market
       FROM price_forecasts pf
       JOIN markets m ON m.id = pf.market_id
       JOIN districts d ON d.id = m.district_id
       JOIN states s ON s.id = d.state_id
       JOIN commodities c ON c.id = pf.commodity_id
       WHERE ($1::text IS NULL OR lower(c.name) = lower($1))
       ORDER BY state, district, market, commodity
       LIMIT 20000`,
      [commodity ?? null]
    );
    return rows;
  }

  async listAvailableLocations(): Promise<LocationOption[]> {
    const { rows } = await getPool().query<{ state: string; district: string }>(
      `SELECT DISTINCT s.name AS state, d.name AS district
       FROM districts d
       JOIN states s ON s.id = d.state_id
       JOIN markets m ON m.district_id = d.id
       JOIN price_forecasts pf ON pf.market_id = m.id
       ORDER BY state, district`
    );
    return rows;
  }

  /**
   * Forecast history (trend/confidence over time) for one (commodity,
   * market) pair, across every reference_date on record — used by the
   * Mandi Prices price-trend chart. Sourced from price_forecasts, not
   * market_prices: the chart plots the model's own tracked series, which is
   * what the CSV-era implementation did too (see csvForecastIndex.getPriceHistory).
   * LIMIT 2000: generous for weekly-cadence forecasts across several years.
   */
  async getPriceHistory(commodity: string, state: string, district: string, market: string): Promise<ForecastRecord[]> {
    const { rows } = await getPool().query<ForecastRow>(
      `${FORECAST_SELECT}
       WHERE lower(c.name) = lower($1) AND lower(s.name) = lower($2)
         AND lower(d.name) = lower($3) AND lower(m.name) = lower($4)
       ORDER BY pf.reference_date ASC
       LIMIT 2000`,
      [commodity, state, district, market]
    );
    return rows.map(mapForecastRow);
  }

  async listAvailableYears(commodity: string, state: string, district: string, market: string): Promise<number[]> {
    const { rows } = await getPool().query<{ year: number }>(
      `SELECT DISTINCT EXTRACT(YEAR FROM mp.observation_date)::int AS year
       FROM market_prices mp
       JOIN markets m ON m.id = mp.market_id
       JOIN districts d ON d.id = m.district_id
       JOIN states s ON s.id = d.state_id
       JOIN commodities c ON c.id = mp.commodity_id
       WHERE lower(c.name) = lower($1) AND lower(s.name) = lower($2)
         AND lower(d.name) = lower($3) AND lower(m.name) = lower($4)
       ORDER BY year ASC`,
      [commodity, state, district, market]
    );
    return rows.map((r) => Number(r.year));
  }

  /**
   * Bounded by the observation_date range for a single year, which lets
   * Postgres prune to exactly one yearly partition (see 002_market_prices.sql)
   * instead of scanning every partition.
   */
  async getYearlyHistory(
    commodity: string,
    state: string,
    district: string,
    market: string,
    year: number
  ): Promise<YearlyHistoryResult> {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year + 1}-01-01`;
    const { rows } = await getPool().query<PriceRow>(
      `${PRICE_SELECT}
       WHERE lower(c.name) = lower($1) AND lower(s.name) = lower($2)
         AND lower(d.name) = lower($3) AND lower(m.name) = lower($4)
         AND mp.observation_date >= $5::date AND mp.observation_date < $6::date
       ORDER BY mp.observation_date ASC
       LIMIT 2000`,
      [commodity, state, district, market, yearStart, yearEnd]
    );
    return { year, records: rows.map(mapPriceRow) };
  }

  async compareYears(
    commodity: string,
    state: string,
    district: string,
    market: string,
    years: number[]
  ): Promise<YearComparisonEntry[]> {
    // One yearly query per requested year (years.length is capped at 10 by
    // yearComparisonQuerySchema) rather than a single ANY($array) query, so
    // each year's query keeps the observation_date range-filter partition
    // pruning described on getYearlyHistory instead of forcing a scan across
    // every partition to satisfy one combined query. Issued concurrently via
    // Promise.all (not sequentially): each is an independent read against
    // the shared pool, pruning is per-query regardless of ordering, and
    // running them in parallel avoids stacking up to 10x the round-trip
    // latency on a single year-comparison request.
    const perYear = await Promise.all(years.map((year) => this.getYearlyHistory(commodity, state, district, market, year)));

    return perYear.map(({ year, records }) => {
      if (records.length === 0) {
        return {
          year,
          hasData: false,
          recordCount: 0,
          latestRecord: null,
          minModalPrice: null,
          maxModalPrice: null,
          avgModalPrice: null,
        };
      }
      const prices = records.map((r) => r.modalPrice);
      return {
        year,
        hasData: true,
        recordCount: records.length,
        latestRecord: records[records.length - 1] ?? null,
        minModalPrice: Math.min(...prices),
        maxModalPrice: Math.max(...prices),
        avgModalPrice: prices.reduce((sum, p) => sum + p, 0) / prices.length,
      };
    });
  }
}

/** Exported for tests that need a raw client without going through a repository method. */
export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
