/**
 * Shared domain types.
 *
 * These mirror the shapes returned by the YieldAI backend (see
 * backend/prisma/schema.prisma and backend/src/controllers/*) so that the
 * mock data layer (lib/mockData.ts) and the real API can be swapped
 * transparently behind lib/dataService.ts.
 */

export type PriceTrend = 'Rising' | 'Stable' | 'Falling';
export type ConfidenceBand = 'High' | 'Medium' | 'Low';

export interface Forecast {
    id: string;
    commodity: string;
    state: string;
    district: string;
    market: string;
    date: string; // ISO date string
    currentModalPrice: number;
    predictedPriceTrend: PriceTrend;
    confidence: number; // 0.0 - 1.0
    confidenceBand: ConfidenceBand;
    priceTrendScore: number; // -1.0 - 1.0
    probFalling: number;
    probRising: number;
    probStable: number;
}

export interface Location {
    state: string;
    district: string;
}

export interface MarketOption {
    commodity: string;
    state: string;
    district: string;
    market: string;
}

export interface Crop {
    id: string;
    name: string;
    category?: string | null;
    typicalYield?: number | null; // quintals per acre
    costOfCultivation?: number | null; // per acre
    growthDuration?: number | null; // days
    bestSeason?: string | null;
}

export interface Recommendation {
    cropId: string;
    name: string;
    category?: string | null;
    score: number;
    expectedProfit: number;
    confidenceScore: number;
    predictedTrend: PriceTrend;
    currentPrice: number;
    bestSeason?: string | null;
    growthDuration?: number | null;
}

export interface MarketAnalysis {
    commodity: string;
    state: string;
    totalMarkets: number;
    risingMarkets: number;
    fallingMarkets: number;
    stableMarkets: number;
    avgPrice: number;
    marketSentiment: 'Bullish' | 'Bearish' | 'Neutral';
}

export interface Broker {
    id: string;
    name: string;
    location: string;
    contact: string;
    commodities: string[];
    rating: number;
    verified: boolean;
}

export interface Report {
    id: string;
    title: string;
    type: string;
    createdAt: string;
    summary?: string;
}

export interface FarmProfile {
    id: string;
    name: string;
    location: string;
    state: string;
    district: string;
    sizeAcres: number;
    soilType: string;
    crops: string[];
    irrigation: string;
}

export interface SoilSample {
    parameter: string;
    value: number;
    unit: string;
    idealMin: number;
    idealMax: number;
    status: 'Low' | 'Optimal' | 'High';
}

export interface YieldPoint {
    season: string;
    actual: number | null;
    predicted: number | null;
}
        
export interface WeatherDay {
    day: string;
    date: string;
    condition: string;
    high: number;
    low: number;
    rainfallChance: number;
}