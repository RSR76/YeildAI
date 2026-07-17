import * as csvForecastIndex from '../lib/csvForecastIndex.js';

/**
 * Serves forecasts from the local CSV-backed provider (genuine precomputed
 * RandomForestClassifier output — see csvForecastIndex.ts). This is a
 * drop-in replacement for the previous Prisma-backed implementation; the
 * Prisma models and prisma/schema.prisma are untouched, so this can be
 * swapped back to querying `prisma.forecast` directly once a real
 * PostgreSQL DATABASE_URL is available locally.
 */
export class ForecastService {
  async getLatestForecast(commodity: string, state: string, district: string, market: string) {
    return csvForecastIndex.getLatestForecast(commodity, state, district, market);
  }

  async getAllLatestForecasts(commodity?: string) {
    return csvForecastIndex.getAllLatestForecasts(commodity);
  }

  async listAvailableCommodities() {
    return csvForecastIndex.listAvailableCommodities();
  }

  async listAvailableMarkets(commodity?: string) {
    return csvForecastIndex.listAvailableMarkets(commodity);
  }

  async listAvailableLocations() {
    return csvForecastIndex.listAvailableLocations();
  }

  async getPriceHistory(commodity: string, state: string, district: string, market: string) {
    return csvForecastIndex.getPriceHistory(commodity, state, district, market);
  }
}
