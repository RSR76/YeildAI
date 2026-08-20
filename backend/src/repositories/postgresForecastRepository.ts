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

function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const n = Number(value);

  return Number.isFinite(n) ? n : null;
}

/**
 * Local YeildAI Forecast table.
 *
 * The current database uses:
 *
 *   "Forecast"
 *
 * rather than the old production tables:
 *
 *   price_forecasts
 *   market_prices
 *   commodities
 *   markets
 *   districts
 *   states
 */

interface ForecastRow {
  id: string;
  commodity: string;
  state: string;
  district: string;
  market: string;
  date: string;
  currentModalPrice: number | string;
  predictedPriceTrend: string;
  confidence: number | string;
  confidenceBand: string;
  priceTrendScore: number | string;
  probFalling: number | string;
  probRising: number | string;
  probStable: number | string;
}

function mapForecastRow(
  row: ForecastRow,
): ForecastRecord {
  return {
    id: String(row.id),
    commodity: row.commodity,
    state: row.state,
    district: row.district,
    market: row.market,
    date: row.date,

    currentModalPrice: num(
      row.currentModalPrice,
    ),

    predictedPriceTrend:
      row.predictedPriceTrend,

    confidence: num(row.confidence),

    confidenceBand:
      row.confidenceBand,

    priceTrendScore: num(
      row.priceTrendScore,
    ),

    probFalling: num(row.probFalling),
    probRising: num(row.probRising),
    probStable: num(row.probStable),
  };
}

function mapPriceRow(
  row: ForecastRow,
): PriceHistoryRecord {
  return {
    id: String(row.id),
    commodity: row.commodity,
    state: row.state,
    district: row.district,
    market: row.market,
    date: row.date,

    modalPrice: num(
      row.currentModalPrice,
    ),

    minPrice: null,
    maxPrice: null,
    variety: null,
    grade: null,
    source: 'forecast',
  };
}

/* =========================================================
   SELECT
========================================================= */

const FORECAST_SELECT = `
  SELECT
    "id",
    "commodity",
    "state",
    "district",
    "market",
    "date",
    "currentModalPrice",
    "predictedPriceTrend",
    "confidence",
    "confidenceBand",
    "priceTrendScore",
    "probFalling",
    "probRising",
    "probStable"
  FROM "Forecast"
`;

/* =========================================================
   REPOSITORY
========================================================= */

export class PostgresForecastRepository
  implements ForecastRepository
{
  /* -------------------------------------------------------
     GET LATEST
  ------------------------------------------------------- */

  async getLatest(
    commodity: string,
    state: string,
    district: string,
    market: string,
  ): Promise<ForecastRecord | null> {
    const { rows } =
      await getPool().query<ForecastRow>(
        `${FORECAST_SELECT}
         WHERE lower("commodity") = lower($1)
           AND lower("state") = lower($2)
           AND lower("district") = lower($3)
           AND lower("market") = lower($4)
         ORDER BY "date" DESC
         LIMIT 1`,
        [
          commodity,
          state,
          district,
          market,
        ],
      );

    return rows[0]
      ? mapForecastRow(rows[0])
      : null;
  }

  /* -------------------------------------------------------
     GET ALL LATEST
  ------------------------------------------------------- */

  async getAllLatest(
    commodity?: string,
    state?: string,
    district?: string,
  ): Promise<ForecastRecord[]> {
    const { rows } =
      await getPool().query<ForecastRow>(
        `SELECT *
         FROM (
           SELECT DISTINCT ON (
             "market",
             "commodity"
           )
             "id",
             "commodity",
             "state",
             "district",
             "market",
             "date",
             "currentModalPrice",
             "predictedPriceTrend",
             "confidence",
             "confidenceBand",
             "priceTrendScore",
             "probFalling",
             "probRising",
             "probStable"
           FROM "Forecast"
           WHERE
             ($1::text IS NULL
              OR lower("commodity") = lower($1))

             AND (
               ($2::text IS NULL
                AND $3::text IS NULL)

               OR (
                 lower("state") = lower($2)
                 AND lower("district") = lower($3)
               )
             )

           ORDER BY
             "market",
             "commodity",
             "date" DESC
         ) latest

         ORDER BY
           "commodity",
           "market"

         LIMIT 5000`,
        [
          commodity ?? null,
          state ?? null,
          district ?? null,
        ],
      );

    return rows.map(mapForecastRow);
  }

  /* -------------------------------------------------------
     COMMODITIES
  ------------------------------------------------------- */

  async listAvailableCommodities(): Promise<
    string[]
  > {
    const { rows } =
      await getPool().query<{
        commodity: string;
      }>(
        `SELECT DISTINCT "commodity"
         FROM "Forecast"
         WHERE "commodity" IS NOT NULL
         ORDER BY "commodity"`,
      );

    return rows.map(
      (row) => row.commodity,
    );
  }

  /* -------------------------------------------------------
     MARKETS
  ------------------------------------------------------- */

  async listAvailableMarkets(
    commodity?: string,
  ): Promise<MarketOption[]> {
    const { rows } =
      await getPool().query<{
        commodity: string;
        state: string;
        district: string;
        market: string;
      }>(
        `SELECT DISTINCT
           "commodity",
           "state",
           "district",
           "market"
         FROM "Forecast"
         WHERE
           ($1::text IS NULL
            OR lower("commodity") = lower($1))

         ORDER BY
           "state",
           "district",
           "market",
           "commodity"

         LIMIT 20000`,
        [commodity ?? null],
      );

    return rows;
  }

  /* -------------------------------------------------------
     LOCATIONS
  ------------------------------------------------------- */

  async listAvailableLocations(): Promise<
    LocationOption[]
  > {
    const { rows } =
      await getPool().query<{
        state: string;
        district: string;
      }>(
        `SELECT DISTINCT
           "state",
           "district"
         FROM "Forecast"
         WHERE
           "state" IS NOT NULL
           AND "district" IS NOT NULL

         ORDER BY
           "state",
           "district"`,
      );

    return rows;
  }

  /* -------------------------------------------------------
     PRICE HISTORY
  ------------------------------------------------------- */

  async getPriceHistory(
    commodity: string,
    state: string,
    district: string,
    market: string,
  ): Promise<ForecastRecord[]> {
    const { rows } =
      await getPool().query<ForecastRow>(
        `${FORECAST_SELECT}
         WHERE lower("commodity") = lower($1)
           AND lower("state") = lower($2)
           AND lower("district") = lower($3)
           AND lower("market") = lower($4)

         ORDER BY "date" ASC

         LIMIT 2000`,
        [
          commodity,
          state,
          district,
          market,
        ],
      );

    return rows.map(mapForecastRow);
  }

  /* -------------------------------------------------------
     AVAILABLE YEARS
  ------------------------------------------------------- */

  async listAvailableYears(
    commodity: string,
    state: string,
    district: string,
    market: string,
  ): Promise<number[]> {
    const { rows } =
      await getPool().query<{
        year: number;
      }>(
        `SELECT DISTINCT
           EXTRACT(
             YEAR FROM "date"
           )::int AS year

         FROM "Forecast"

         WHERE lower("commodity") = lower($1)
           AND lower("state") = lower($2)
           AND lower("district") = lower($3)
           AND lower("market") = lower($4)

         ORDER BY year ASC`,
        [
          commodity,
          state,
          district,
          market,
        ],
      );

    return rows.map(
      (row) => Number(row.year),
    );
  }

  /* -------------------------------------------------------
     YEARLY HISTORY
  ------------------------------------------------------- */

  async getYearlyHistory(
    commodity: string,
    state: string,
    district: string,
    market: string,
    year: number,
  ): Promise<YearlyHistoryResult> {
    const yearStart =
      `${year}-01-01`;

    const yearEnd =
      `${year + 1}-01-01`;

    const { rows } =
      await getPool().query<ForecastRow>(
        `SELECT
           "id",
           "commodity",
           "state",
           "district",
           "market",
           "date",
           "currentModalPrice",
           "predictedPriceTrend",
           "confidence",
           "confidenceBand",
           "priceTrendScore",
           "probFalling",
           "probRising",
           "probStable"

         FROM "Forecast"

         WHERE lower("commodity") = lower($1)
           AND lower("state") = lower($2)
           AND lower("district") = lower($3)
           AND lower("market") = lower($4)

           AND "date" >= $5::date
           AND "date" < $6::date

         ORDER BY "date" ASC

         LIMIT 2000`,
        [
          commodity,
          state,
          district,
          market,
          yearStart,
          yearEnd,
        ],
      );

    return {
      year,
      records: rows.map(mapPriceRow),
    };
  }

  /* -------------------------------------------------------
     COMPARE YEARS
  ------------------------------------------------------- */

  async compareYears(
    commodity: string,
    state: string,
    district: string,
    market: string,
    years: number[],
  ): Promise<YearComparisonEntry[]> {
    const perYear =
      await Promise.all(
        years.map((year) =>
          this.getYearlyHistory(
            commodity,
            state,
            district,
            market,
            year,
          ),
        ),
      );

    return perYear.map(
      ({ year, records }) => {
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

        const prices =
          records.map(
            (record) =>
              record.modalPrice,
          );

        return {
          year,
          hasData: true,
          recordCount: records.length,

          latestRecord:
            records[
              records.length - 1
            ] ?? null,

          minModalPrice:
            Math.min(...prices),

          maxModalPrice:
            Math.max(...prices),

          avgModalPrice:
            prices.reduce(
              (sum, price) =>
                sum + price,
              0,
            ) / prices.length,
        };
      },
    );
  }
}

/* =========================================================
   RAW CLIENT
========================================================= */

export async function withClient<T>(
  fn: (
    client: PoolClient,
  ) => Promise<T>,
): Promise<T> {
  const client =
    await getPool().connect();

  try {
    return await fn(client);
  } finally {
    client.release();
  }
}