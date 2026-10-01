/**
 * Legacy/dev-only ForecastRepository implementation: a thin adapter over the
 * existing in-memory CSV index (lib/csvForecastIndex.ts). Behavior is
 * unchanged from before the repository layer existed — this file only
 * reshapes the same calls to satisfy the ForecastRepository interface, plus
 * derives the new year-aware methods honestly from whatever date range the
 * loaded CSV actually contains.
 *
 * "Honestly" matters here: forecast_lookup_all_commodities.csv is a rolling
 * snapshot, not a genuine multi-year archive. If it only contains one
 * calendar year, listAvailableYears() returns exactly that one year and
 * compareYears() reports every other requested year as { hasData: false },
 * never a fabricated zero-price year. Real multi-year comparison requires
 * PostgresForecastRepository against ingested market_prices history.
 */

import * as csvForecastIndex from '../lib/csvForecastIndex.js';
import type {
  ForecastRepository,
  ForecastRecord,
  LocationOption,
  MarketOption,
  PriceHistoryRecord,
  YearlyHistoryResult,
  YearComparisonEntry,
} from './forecastRepository.js';

function yearOf(record: ForecastRecord): number | null {
  const year = Number(record.date.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

// forecast_lookup_all_commodities.csv is a precomputed forecast snapshot,
// not a raw price ledger — it has no min/max price or variety/grade columns.
// Mapping it into PriceHistoryRecord is honest about that gap (nulls, and a
// source string that says so) rather than inventing values those columns
// never had.
function toPriceHistoryRecord(record: ForecastRecord): PriceHistoryRecord {
  return {
    id: record.id,
    commodity: record.commodity,
    state: record.state,
    district: record.district,
    market: record.market,
    date: record.date,
    modalPrice: record.currentModalPrice,
    minPrice: null,
    maxPrice: null,
    variety: null,
    grade: null,
    source: 'csv-forecast-lookup (derived from forecast snapshot, not a raw historical price record)',
  };
}

export class CsvForecastRepository implements ForecastRepository {
  async getLatest(commodity: string, state: string, district: string, market: string): Promise<ForecastRecord | null> {
    return csvForecastIndex.getLatestForecast(commodity, state, district, market);
  }

  async getAllLatest(commodity?: string, state?: string, district?: string): Promise<ForecastRecord[]> {
    return csvForecastIndex.getAllLatestForecasts(commodity, state, district);
  }

  async listAvailableCommodities(): Promise<string[]> {
    return csvForecastIndex.listAvailableCommodities();
  }

  async listAvailableMarkets(commodity?: string): Promise<MarketOption[]> {
    return csvForecastIndex.listAvailableMarkets(commodity);
  }

  async listAvailableLocations(): Promise<LocationOption[]> {
    return csvForecastIndex.listAvailableLocations();
  }

  async getPriceHistory(commodity: string, state: string, district: string, market: string): Promise<ForecastRecord[]> {
    return csvForecastIndex.getPriceHistory(commodity, state, district, market);
  }

  async listAvailableYears(commodity: string, state: string, district: string, market: string): Promise<number[]> {
    const history = await this.getPriceHistory(commodity, state, district, market);
    const years = new Set<number>();
    for (const record of history) {
      const year = yearOf(record);
      if (year !== null) years.add(year);
    }
    return Array.from(years).sort((a, b) => a - b);
  }

  async getYearlyHistory(
    commodity: string,
    state: string,
    district: string,
    market: string,
    year: number
  ): Promise<YearlyHistoryResult> {
    const history = await this.getPriceHistory(commodity, state, district, market);
    return { year, records: history.filter((r) => yearOf(r) === year).map(toPriceHistoryRecord) };
  }

  async compareYears(
    commodity: string,
    state: string,
    district: string,
    market: string,
    years: number[]
  ): Promise<YearComparisonEntry[]> {
    const history = await this.getPriceHistory(commodity, state, district, market);

    return years.map((year) => {
      const recordsForYear = history.filter((r) => yearOf(r) === year);
      if (recordsForYear.length === 0) {
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

      // CSV rows for a given key are in ascending date order (see
      // csvForecastIndex.ts), so the last matching row is the latest.
      const latestRecord = recordsForYear[recordsForYear.length - 1] ?? null;
      const prices = recordsForYear.map((r) => r.currentModalPrice);

      return {
        year,
        hasData: true,
        recordCount: recordsForYear.length,
        latestRecord: latestRecord ? toPriceHistoryRecord(latestRecord) : null,
        minModalPrice: Math.min(...prices),
        maxModalPrice: Math.max(...prices),
        avgModalPrice: prices.reduce((sum, p) => sum + p, 0) / prices.length,
      };
    });
  }
}
