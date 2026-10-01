import { getForecastRepository } from '../repositories/forecastRepositoryFactory.js';
import type { ForecastRepository } from '../repositories/forecastRepository.js';

/**
 * Serves forecasts from whichever ForecastRepository was selected at
 * startup (Postgres or the legacy CSV index — see
 * forecastRepositoryFactory.ts). This service no longer knows or cares
 * which one it is; that decision, and the readiness gating around it, lives
 * entirely in the factory. Defaults to the factory-selected singleton but
 * accepts an explicit repository for tests.
 */
export class ForecastService {
  // Resolved lazily per call, NOT captured in the constructor: controllers
  // instantiate their service at module-import time (e.g. `const
  // forecastService = new ForecastService()` in forecast.controller.ts),
  // which happens before src/index.ts calls initializeForecastRepository()
  // from its app.listen() callback. Resolving eagerly here would throw at
  // import time, before the process has even started listening.
  private readonly override?: ForecastRepository | undefined;

  constructor(repository?: ForecastRepository) {
    this.override = repository;
  }

  private repo(): ForecastRepository {
    return this.override ?? getForecastRepository();
  }

  async getLatestForecast(commodity: string, state: string, district: string, market: string) {
    return this.repo().getLatest(commodity, state, district, market);
  }

  async getAllLatestForecasts(commodity?: string, state?: string, district?: string) {
    return this.repo().getAllLatest(commodity, state, district);
  }

  async listAvailableCommodities() {
    return this.repo().listAvailableCommodities();
  }

  async listAvailableMarkets(commodity?: string) {
    return this.repo().listAvailableMarkets(commodity);
  }

  async listAvailableLocations() {
    return this.repo().listAvailableLocations();
  }

  async getPriceHistory(commodity: string, state: string, district: string, market: string) {
    return this.repo().getPriceHistory(commodity, state, district, market);
  }

  async listAvailableYears(commodity: string, state: string, district: string, market: string) {
    return this.repo().listAvailableYears(commodity, state, district, market);
  }

  async getYearlyHistory(commodity: string, state: string, district: string, market: string, year: number) {
    return this.repo().getYearlyHistory(commodity, state, district, market, year);
  }

  async compareYears(commodity: string, state: string, district: string, market: string, years: number[]) {
    return this.repo().compareYears(commodity, state, district, market, years);
  }
}
