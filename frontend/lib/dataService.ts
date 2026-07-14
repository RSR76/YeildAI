/**
 * Data service layer.
 *
 * Every function here first tries the real backend (via apiClient) and
 * transparently falls back to the mock data layer (lib/mockData.ts) if the
 * request fails — e.g. because the production CSV / database is not yet
 * available in this environment.
 *
 * Once the real backend is live everywhere, the try/catch fallbacks below
 * can be removed and these functions will keep working unchanged, since
 * pages only ever import from this file, never from lib/mockData.ts
 * directly.
 */

import { apiClient } from './api';
import type { Forecast, Recommendation, MarketAnalysis, Broker, Report } from './types';
import {
    DEFAULT_LOCATION,
    mockForecasts,
    mockPriceHistory,
    mockRecommendations,
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

export function getAllLatestForecasts(commodity?: string): Promise<Forecast[]> {
    return withFallback(
        () => apiClient<Forecast[]>('/forecast/all-latest', commodity ? { commodity } : undefined),
        commodity
            ? mockForecasts.filter((f) => f.commodity.toLowerCase() === commodity.toLowerCase())
            : mockForecasts
    );
}

export function getForecastHistory(
    commodity: string,
    state: string,
    district: string,
    market: string
): Promise<Forecast[]> {
    return withFallback(
        () => apiClient<Forecast[]>('/forecast/history', { commodity, state, district, market }),
        mockPriceHistory
    );
}

export function getCommodities(): Promise<string[]> {
    return withFallback(
        () => apiClient<string[]>('/forecast/commodities'),
        Array.from(new Set(mockForecasts.map((f) => f.commodity))).sort()
    );
}

export function getRecommendations(
    state: string = DEFAULT_LOCATION.state,
    district: string = DEFAULT_LOCATION.district
): Promise<Recommendation[]> {
    return withFallback(
        () => apiClient<Recommendation[]>('/recommendations', { state, district }),
        mockRecommendations
    );
}

export function getMarketAnalysis(commodity: string, state: string): Promise<MarketAnalysis> {
    return withFallback(
        () => apiClient<MarketAnalysis>('/analysis', { commodity, state }),
        mockMarketAnalysis
    );
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