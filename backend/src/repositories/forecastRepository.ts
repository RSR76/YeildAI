/**
 * Storage-agnostic forecast data access contract. Services (forecast.service.ts,
 * recommendation.service.ts, geocode.service.ts) depend on this interface, not
 * on csvForecastIndex.ts or Postgres directly — callers should never need to
 * know or care which repository is actually serving a request.
 *
 * Two implementations exist:
 *   - CsvForecastRepository  (csvForecastRepository.ts)  — wraps the existing
 *     in-memory CSV index. Legacy/dev-only; see docs/POSTGRES_FORECAST_MIGRATION_PLAN.md.
 *   - PostgresForecastRepository (postgresForecastRepository.ts) — queries the
 *     partitioned market_prices / price_forecasts schema. Production target.
 *
 * forecastRepositoryFactory.ts picks exactly one at process startup based on
 * FORECAST_DATA_SOURCE — never a per-request fallback between the two.
 */

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

export interface LocationOption {
  state: string;
  district: string;
}

export interface MarketOption {
  commodity: string;
  state: string;
  district: string;
  market: string;
}

/**
 * A genuine historical price observation — deliberately a *different* shape
 * from ForecastRecord. ForecastRecord carries model output (trend,
 * confidence, probabilities); a raw historical price row has none of that,
 * and synthesizing fake trend/confidence values to force-fit ForecastRecord
 * would misrepresent real market_prices data as model predictions. Used by
 * the year-aware history methods below, which are about genuine multi-year
 * records, not forecasts.
 */
export interface PriceHistoryRecord {
  id: string;
  commodity: string;
  state: string;
  district: string;
  market: string;
  date: string;
  modalPrice: number;
  minPrice: number | null;
  maxPrice: number | null;
  variety: string | null;
  grade: string | null;
  /** Ingestion provenance, e.g. 'agmarknet-data-gov-in' or, for the legacy CSV repository, an explicit note that this is derived from the forecast snapshot rather than a raw price record. */
  source: string;
}

/** One calendar year's worth of history for a single (commodity, market) pair. */
export interface YearlyHistoryResult {
  year: number;
  records: PriceHistoryRecord[];
}

/**
 * Per-year summary for a year-over-year comparison. `hasData: false` means
 * exactly that — no records exist for that year at that market/commodity —
 * and callers must render an honest "no data" state, never a fabricated 0.
 * `latestRecord` is the last observation within that year (by date), so a
 * caller can show "modal price as of <date>" per year, not just an average.
 */
export interface YearComparisonEntry {
  year: number;
  hasData: boolean;
  recordCount: number;
  latestRecord: PriceHistoryRecord | null;
  minModalPrice: number | null;
  maxModalPrice: number | null;
  avgModalPrice: number | null;
}

export interface ForecastRepository {
  getLatest(commodity: string, state: string, district: string, market: string): Promise<ForecastRecord | null>;

  getAllLatest(commodity?: string, state?: string, district?: string): Promise<ForecastRecord[]>;

  listAvailableCommodities(): Promise<string[]>;

  listAvailableMarkets(commodity?: string): Promise<MarketOption[]>;

  listAvailableLocations(): Promise<LocationOption[]>;

  /** Full price/forecast history for one (commodity, market) pair, across all years available. */
  getPriceHistory(commodity: string, state: string, district: string, market: string): Promise<ForecastRecord[]>;

  /** Distinct calendar years for which at least one record exists for this (commodity, market) pair, ascending. */
  listAvailableYears(commodity: string, state: string, district: string, market: string): Promise<number[]>;

  /** Every record for this (commodity, market) pair within a single calendar year. */
  getYearlyHistory(commodity: string, state: string, district: string, market: string, year: number): Promise<YearlyHistoryResult>;

  /** Year-over-year comparison for the requested years, in the order requested. Missing years are reported honestly, not interpolated. */
  compareYears(
    commodity: string,
    state: string,
    district: string,
    market: string,
    years: number[]
  ): Promise<YearComparisonEntry[]>;
}
