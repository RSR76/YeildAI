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

import { apiClient, apiRequest, type ApiClientOptions } from './api';
import type { Forecast, Recommendation, MarketAnalysis, Broker, Report, Location, MarketOption, ReverseGeocodeResult, AdminRegionSummary, AdminDistrictDetail, YearlyHistory, YearComparisonEntry } from './types';
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

export function getAllLatestForecasts(
    commodity?: string,
    state?: string,
    district?: string,
    options?: ApiClientOptions
): Promise<Forecast[]> {
    const params: Record<string, string> = {};
    if (commodity) params.commodity = commodity;
    // state/district are an optional pair on the backend — both or neither.
    if (state && district) {
        params.state = state;
        params.district = district;
    }
    return apiClient<Forecast[]>('/forecast/all-latest', Object.keys(params).length ? params : undefined, options);
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

/**
 * Genuine multi-year history (Phase 7/14) — no mock fallback, same as the
 * rest of the forecast/recommendation data: a backend failure must surface
 * as a visible error, never silently swap in fabricated years.
 */
/** Distinct calendar years with at least one stored record for this (commodity, market) pair. Bare array — see backend/src/controllers/forecast.controller.ts#getYears. */
export function listAvailableYears(
    commodity: string,
    state: string,
    district: string,
    market: string,
    options?: ApiClientOptions
): Promise<number[]> {
    return apiClient<number[]>('/forecast/years', { commodity, state, district, market }, options);
}

export function getYearlyHistory(
    commodity: string,
    state: string,
    district: string,
    market: string,
    year: number,
    options?: ApiClientOptions
): Promise<YearlyHistory> {
    return apiClient<YearlyHistory>(
        '/forecast/yearly-history',
        { commodity, state, district, market, year: String(year) },
        options
    );
}

/** Year-over-year comparison. Bare array (one entry per requested year, in order) — see backend/src/controllers/forecast.controller.ts#getYearComparison. */
export function compareYears(
    commodity: string,
    state: string,
    district: string,
    market: string,
    years: number[],
    options?: ApiClientOptions
): Promise<YearComparisonEntry[]> {
    return apiClient<YearComparisonEntry[]>(
        '/forecast/year-comparison',
        { commodity, state, district, market, years: years.join(',') },
        options
    );
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

/**
 * Resolves a map pin's coordinates to a place name and, when possible, a
 * supported (state, district) pair from the forecast dataset. No mock
 * fallback: a backend failure must surface as a visible error so the caller
 * can fall back to the manual state/district selectors, not silently swap
 * in fabricated location data.
 */
export function reverseGeocode(latitude: number, longitude: number, options?: ApiClientOptions): Promise<ReverseGeocodeResult> {
    return apiClient<ReverseGeocodeResult>('/geocode/reverse', { lat: String(latitude), lon: String(longitude) }, options);
}

/**
 * Admin-only. Country-wide (state, district) summary for the landing map.
 * Requires an ADMIN session — apiRequest is expected to attach the stored
 * auth token automatically (same as every other authClient.ts call), so
 * nothing extra is passed here.
 */
export function getAdminRegions(): Promise<AdminRegionSummary[]> {
    return apiRequest<AdminRegionSummary[]>('/admin/regions', { method: 'GET' });
}

/** Admin-only. Every registered farm in one district plus that district's recommendations + reasoning. */
export function getAdminDistrict(state: string, district: string): Promise<AdminDistrictDetail> {
    return apiRequest<AdminDistrictDetail>(
        `/admin/regions/${encodeURIComponent(state)}/${encodeURIComponent(district)}`,
        { method: 'GET' }
    );
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
