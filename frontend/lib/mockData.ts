/**
 * TEMPORARY MOCK DATA LAYER
 * -------------------------
 * The production forecast CSV / live database is not available in this
 * environment. Everything in this file mirrors the exact shapes defined in
 * `lib/types.ts` (which in turn mirror `backend/prisma/schema.prisma` and
 * the real API responses documented in HANDOFF_README.md).
 *
 * This file is intentionally isolated so it can be deleted once the real
 * backend/CSV is wired up — nothing outside `lib/dataService.ts` should
 * import from here directly.
 */

import type {
        Forecast,
        Recommendation,
        MarketAnalysis,
        Broker,
        Report,
        FarmProfile,
        SoilSample,
        YieldPoint,
        WeatherDay,
    } from './types';
    
    export const DEFAULT_LOCATION = {
        state: 'Uttar Pradesh',
        district: 'Barabanki',
    };
    
    export const mockFarmProfile: FarmProfile = {
        id: 'farm-001',
        name: 'Green Acres',
        location: 'Barabanki, Uttar Pradesh',
        state: 'Uttar Pradesh',
        district: 'Barabanki',
        sizeAcres: 50,
        soilType: 'Alluvial loam',
        crops: ['Wheat', 'Rice', 'Soybean'],
        irrigation: 'Canal + tube well',
    };
    
    export const mockForecasts: Forecast[] = [
        {
            id: 'fc-001',
            commodity: 'Tomato',
            state: 'Uttar Pradesh',
            district: 'Barabanki',
            market: 'Barabanki',
            date: '2026-07-08',
            currentModalPrice: 860,
            predictedPriceTrend: 'Rising',
            confidence: 0.96,
            confidenceBand: 'High',
            priceTrendScore: 0.95,
            probFalling: 0.01,
            probRising: 0.96,
            probStable: 0.02,
        },
        {
            id: 'fc-002',
            commodity: 'Soybean',
            state: 'Uttar Pradesh',
            district: 'Barabanki',
            market: 'Barabanki',
            date: '2026-07-08',
            currentModalPrice: 4890,
            predictedPriceTrend: 'Rising',
            confidence: 0.87,
            confidenceBand: 'High',
            priceTrendScore: 0.74,
            probFalling: 0.05,
            probRising: 0.87,
            probStable: 0.08,
        },
        {
            id: 'fc-003',
            commodity: 'Cotton',
            state: 'Uttar Pradesh',
            district: 'Barabanki',
            market: 'Barabanki',
            date: '2026-07-08',
            currentModalPrice: 7320,
            predictedPriceTrend: 'Rising',
            confidence: 0.81,
            confidenceBand: 'High',
            priceTrendScore: 0.58,
            probFalling: 0.09,
            probRising: 0.81,
            probStable: 0.1,
        },
        {
            id: 'fc-004',
            commodity: 'Maize',
            state: 'Uttar Pradesh',
            district: 'Barabanki',
            market: 'Barabanki',
            date: '2026-07-08',
            currentModalPrice: 2340,
            predictedPriceTrend: 'Stable',
            confidence: 0.74,
            confidenceBand: 'Medium',
            priceTrendScore: 0.1,
            probFalling: 0.18,
            probRising: 0.28,
            probStable: 0.54,
        },
        {
            id: 'fc-005',
            commodity: 'Onion',
            state: 'Uttar Pradesh',
            district: 'Barabanki',
            market: 'Barabanki',
            date: '2026-07-08',
            currentModalPrice: 1840,
            predictedPriceTrend: 'Falling',
            confidence: 0.58,
            confidenceBand: 'Medium',
            priceTrendScore: -0.32,
            probFalling: 0.58,
            probRising: 0.26,
            probStable: 0.16,
        },
        {
            id: 'fc-006',
            commodity: 'Wheat',
            state: 'Uttar Pradesh',
            district: 'Barabanki',
            market: 'Barabanki',
            date: '2026-07-08',
            currentModalPrice: 2260,
            predictedPriceTrend: 'Falling',
            confidence: 0.91,
            confidenceBand: 'High',
            priceTrendScore: -0.68,
            probFalling: 0.83,
            probRising: 0.07,
            probStable: 0.1,
        },
        {
            id: 'fc-007',
            commodity: 'Tur (Pigeon Pea)',
            state: 'Uttar Pradesh',
            district: 'Barabanki',
            market: 'Barabanki',
            date: '2026-07-08',
            currentModalPrice: 7690,
            predictedPriceTrend: 'Stable',
            confidence: 0.68,
            confidenceBand: 'Medium',
            priceTrendScore: 0.03,
            probFalling: 0.24,
            probRising: 0.27,
            probStable: 0.49,
        },
    ];
    
    // 8-week price history for the mandi-prices detail chart (Tomato, Barabanki)
    export const mockPriceHistory: Forecast[] = Array.from({ length: 8 }).map((_, i) => {
        const base = 720 + i * 18;
        return {
            id: `hist-${i}`,
            commodity: 'Tomato',
            state: 'Uttar Pradesh',
            district: 'Barabanki',
            market: 'Barabanki',
            date: `2026-05-${(11 + i * 7).toString().padStart(2, '0')}`,
            currentModalPrice: base,
            predictedPriceTrend: 'Rising',
            confidence: 0.8 + i * 0.01,
            confidenceBand: 'High',
            priceTrendScore: 0.5 + i * 0.05,
            probFalling: 0.05,
            probRising: 0.85,
            probStable: 0.1,
        };
    });
    
    export const mockRecommendations: Recommendation[] = [
        {
            cropId: 'crop-soybean',
            name: 'Soybean',
            category: 'Oilseed',
            score: 88.4,
            expectedProfit: 42600,
            confidenceScore: 0.87,
            predictedTrend: 'Rising',
            currentPrice: 4890,
            bestSeason: 'Kharif',
            growthDuration: 100,
        },
        {
            cropId: 'crop-cotton',
            name: 'Cotton',
            category: 'Fiber',
            score: 79.1,
            expectedProfit: 39800,
            confidenceScore: 0.81,
            predictedTrend: 'Rising',
            currentPrice: 7320,
            bestSeason: 'Kharif',
            growthDuration: 160,
        },
        {
            cropId: 'crop-maize',
            name: 'Maize',
            category: 'Cereal',
            score: 65.3,
            expectedProfit: 33150,
            confidenceScore: 0.74,
            predictedTrend: 'Stable',
            currentPrice: 2340,
            bestSeason: 'Kharif / Rabi',
            growthDuration: 95,
        },
        {
            cropId: 'crop-turdal',
            name: 'Tur (Pigeon Pea)',
            category: 'Pulse',
            score: 58.7,
            expectedProfit: 30250,
            confidenceScore: 0.68,
            predictedTrend: 'Stable',
            currentPrice: 7690,
            bestSeason: 'Kharif',
            growthDuration: 150,
        },
        {
            cropId: 'crop-onion',
            name: 'Onion',
            category: 'Vegetable',
            score: 41.2,
            expectedProfit: 27400,
            confidenceScore: 0.58,
            predictedTrend: 'Falling',
            currentPrice: 1840,
            bestSeason: 'Rabi',
            growthDuration: 120,
        },
        {
            cropId: 'crop-wheat',
            name: 'Wheat',
            category: 'Cereal',
            score: 22.6,
            expectedProfit: 21300,
            confidenceScore: 0.91,
            predictedTrend: 'Falling',
            currentPrice: 2260,
            bestSeason: 'Rabi',
            growthDuration: 145,
        },
    ];
    
    export const mockMarketAnalysis: MarketAnalysis = {
        commodity: 'Soybean',
        state: 'Uttar Pradesh',
        totalMarkets: 24,
        risingMarkets: 16,
        fallingMarkets: 4,
        stableMarkets: 4,
        avgPrice: 4870.5,
        marketSentiment: 'Bullish',
    };
    
    export const mockBrokers: Broker[] = [
        {
            id: 'broker-001',
            name: 'Awasthi Grain Traders',
            location: 'Barabanki Mandi, Uttar Pradesh',
            contact: '+91 98765 43210',
            commodities: ['Wheat', 'Soybean', 'Maize'],
            rating: 4.6,
            verified: true,
        },
        {
            id: 'broker-002',
            name: 'Ganga Agro Commodities',
            location: 'Lucknow Mandi, Uttar Pradesh',
            contact: '+91 91234 56789',
            commodities: ['Cotton', 'Tur (Pigeon Pea)'],
            rating: 4.2,
            verified: true,
        },
        {
            id: 'broker-003',
            name: 'Barabanki Fresh Produce Co.',
            location: 'Barabanki Mandi, Uttar Pradesh',
            contact: '+91 99887 76655',
            commodities: ['Tomato', 'Onion'],
            rating: 3.9,
            verified: false,
        },
    ];
    
    export const mockReports: Report[] = [
        {
            id: 'report-001',
            title: 'Kharif 2026 Crop Recommendation Summary',
            type: 'Recommendation',
            createdAt: '2026-06-30',
            summary: 'Ranked crop opportunities for Barabanki district based on demand-supply signals and MSP margins.',
        },
        {
            id: 'report-002',
            title: 'Soybean vs. Wheat — Risk Comparison',
            type: 'Risk Analysis',
            createdAt: '2026-06-22',
            summary: 'Side-by-side weather, volatility, and oversupply risk profile across the two crops.',
        },
        {
            id: 'report-003',
            title: 'June Mandi Price Trend Report',
            type: 'Market',
            createdAt: '2026-06-05',
            summary: 'Monthly price movement and arrival volume trends for tracked commodities in Barabanki mandi.',
        },
    ];
    
    export const mockSoilSamples: SoilSample[] = [
        { parameter: 'Soil pH', value: 6.5, unit: 'pH', idealMin: 6.0, idealMax: 7.5, status: 'Optimal' },
        { parameter: 'Nitrogen (N)', value: 285, unit: 'kg/ha', idealMin: 240, idealMax: 480, status: 'Optimal' },
        { parameter: 'Phosphorus (P)', value: 18, unit: 'kg/ha', idealMin: 22, idealMax: 55, status: 'Low' },
        { parameter: 'Potassium (K)', value: 310, unit: 'kg/ha', idealMin: 110, idealMax: 280, status: 'High' },
        { parameter: 'Organic Carbon', value: 0.62, unit: '%', idealMin: 0.5, idealMax: 1.0, status: 'Optimal' },
        { parameter: 'Moisture', value: 21, unit: '%', idealMin: 18, idealMax: 30, status: 'Optimal' },
    ];
    
    export const mockYieldTrend: YieldPoint[] = [
        { season: 'Rabi 2023', actual: 38, predicted: null },
        { season: 'Kharif 2024', actual: 41, predicted: null },
        { season: 'Rabi 2024', actual: 39, predicted: null },
        { season: 'Kharif 2025', actual: 44, predicted: null },
        { season: 'Rabi 2025', actual: 43, predicted: 43 },
        { season: 'Kharif 2026', actual: null, predicted: 47 },
        { season: 'Rabi 2026', actual: null, predicted: 49 },
    ];
    
    export const mockWeatherWeek: WeatherDay[] = [
        { day: 'Mon', date: 'Jul 14', condition: 'Partly Cloudy', high: 33, low: 26, rainfallChance: 20 },
        { day: 'Tue', date: 'Jul 15', condition: 'Thunderstorms', high: 30, low: 25, rainfallChance: 75 },
        { day: 'Wed', date: 'Jul 16', condition: 'Rain', high: 28, low: 24, rainfallChance: 85 },
        { day: 'Thu', date: 'Jul 17', condition: 'Rain', high: 27, low: 24, rainfallChance: 80 },
        { day: 'Fri', date: 'Jul 18', condition: 'Cloudy', high: 29, low: 25, rainfallChance: 45 },
        { day: 'Sat', date: 'Jul 19', condition: 'Sunny', high: 32, low: 26, rainfallChance: 10 },
        { day: 'Sun', date: 'Jul 20', condition: 'Sunny', high: 33, low: 26, rainfallChance: 5 },
    ];