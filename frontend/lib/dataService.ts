/**
 * Data service layer.
 *
 * Most functions here try the real backend (via apiClient) and transparently
 * fall back to the mock data layer (lib/mockData.ts) if the request fails —
 * e.g. because a backend module hasn't been built yet.
 *
 * Forecast and recommendation data (Mandi Prices / Recommendations pages) is
 * an exception: the backend for those is real and running locally, so those
 * functions call the API directly with no mock fallback — a backend failure
 * should surface as a visible error on the page, not silently swap in mock
 * data.
 */

import { apiClient, type ApiClientOptions } from './api';
import type { Forecast, Recommendation, MarketAnalysis, Broker, Report, Location, MarketOption } from './types';
import {
    DEFAULT_LOCATION,
    mockMarketAnalysis,
    mockBrokers,
    mockReports,
} from './mockData';

export { DEFAULT_LOCATION };

async function withFallback<T>(request: () => Promise<T>, fallback: T): Promise<T> {
    try {
        return await request();
    } catch {
        return fallback;
    }
}

export function getAllLatestForecasts(commodity?: string, options?: ApiClientOptions): Promise<Forecast[]> {
    return apiClient<Forecast[]>('/forecast/all-latest', commodity ? { commodity } : undefined, options);
}

export function getForecastHistory(
    commodity: string,
    state: string,
    district: string,
    market: string,
    options?: ApiClientOptions
): Promise<Forecast[]> {
    return apiClient<Forecast[]>('/forecast/history', { commodity, state, district, market }, options);
}

export function getCommodities(options?: ApiClientOptions): Promise<string[]> {
    return apiClient<string[]>('/forecast/commodities', undefined, options);
}

export function getMarkets(commodity?: string, options?: ApiClientOptions): Promise<MarketOption[]> {
    return apiClient<MarketOption[]>('/forecast/markets', commodity ? { commodity } : undefined, options);
}

export function getLocations(options?: ApiClientOptions): Promise<Location[]> {
    return apiClient<Location[]>('/forecast/locations', undefined, options);
}

export function getRecommendations(
    state: string = DEFAULT_LOCATION.state,
    district: string = DEFAULT_LOCATION.district,
    options?: ApiClientOptions
): Promise<Recommendation[]> {
    return apiClient<Recommendation[]>('/recommendations', { state, district }, options);
}

export function getMarketAnalysis(commodity: string, state: string): Promise<MarketAnalysis> {
    return withFallback(() => apiClient<MarketAnalysis>('/analysis', { commodity, state }), mockMarketAnalysis);
}

export function getBrokers(): Promise<Broker[]> {
    return withFallback(() => apiClient<Broker[]>('/brokers'), mockBrokers);
}

export function getReports(): Promise<Report[]> {
    // No dedicated /reports endpoint exists on the backend yet — this reads
    // the `Report` model shape from the schema, so it will work as-is once
    // one is added.
    return Promise.resolve(mockReports);
}
