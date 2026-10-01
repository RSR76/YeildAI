// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import RecommendationsPage from '../app/(app)/recommendations/page';
import { getRecommendations } from '../lib/dataService';
import type { EffectiveLocation, FarmLocationStatus, Recommendation } from '../lib/types';

// A real AuthContext only produces a new `activeFarm` reference when the
// farm actually changes — this must be a stable module-level object, not a
// fresh literal returned on every call. `activeFarm` is a dependency of the
// data-fetching useEffect in RecommendationsPage; a non-memoized mock here
// makes that effect see a "changed" dependency on every single render,
// re-firing indefinitely (each run unconditionally calls
// setExpandedCropIds(new Set()), which is never referentially equal to the
// previous Set and so always triggers another render) — an infinite
// render/effect loop that manifests as the vitest worker running out of
// heap, not a real defect in RecommendationsPage itself.
const mockActiveFarm = { id: 'farm-1', state: 'Telangana', district: 'Warangal' };

vi.mock('../lib/auth/AuthContext', () => ({
    useAuth: () => ({ activeFarm: mockActiveFarm }),
}));

const baseEffectiveLocation: EffectiveLocation = {
    state: 'Telangana',
    district: 'Warangal',
    source: 'farm',
    isSupported: true,
};

vi.mock('../lib/useEffectiveLocation', () => ({
    useEffectiveLocation: () => ({
        effectiveLocation: baseEffectiveLocation,
        farmLocationStatus: 'supported' as FarmLocationStatus,
        locations: [{ state: 'Telangana', district: 'Warangal' }],
        locationsError: null,
        hasOverride: false,
        setManualLocation: vi.fn(),
        setMapLocation: vi.fn(),
        resetToFarm: vi.fn(),
    }),
}));

// LocationBar renders a Leaflet map via next/dynamic (needs browser APIs
// jsdom doesn't provide) and is exercised by its own test suite — stub it
// here so this file stays focused on the reasoning UI.
vi.mock('../components/location/LocationBar', () => ({
    LocationBar: () => <div data-testid="location-bar-stub" />,
}));

vi.mock('../lib/dataService', () => ({
    getRecommendations: vi.fn(),
}));

const mockedGetRecommendations = getRecommendations as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

function rising(overrides: Partial<Recommendation> = {}): Recommendation {
    return {
        cropId: 'wheat',
        name: 'Wheat',
        category: 'Cereal',
        score: 82.5,
        expectedProfit: 15000,
        confidenceScore: 0.9,
        predictedTrend: 'Rising',
        currentPrice: 2000,
        bestSeason: 'Rabi',
        growthDuration: 120,
        confidenceBand: 'High',
        probFalling: 0.05,
        probRising: 0.9,
        probStable: 0.05,
        predictedPrice: 2300,
        reasoning: {
            summary: 'A rising trend with high confidence supports a projected profit.',
            factors: [
                {
                    factor: 'Price trend',
                    detail: 'The forecast model predicts a rising price trend for this crop over the next 7 days.',
                    direction: 'positive',
                },
                {
                    factor: 'Forecast confidence',
                    detail: 'Model confidence in this trend is 90% (High).',
                    direction: 'positive',
                },
                {
                    factor: 'Expected profit',
                    detail: 'Estimated profit is ₹15,000 per acre at a projected price of ₹2,300 (current price ₹2,000).',
                    direction: 'positive',
                },
            ],
            limitations: ['Farm-specific soil suitability is not yet included in this recommendation.'],
        },
        ...overrides,
    };
}

function fallingButProfitable(overrides: Partial<Recommendation> = {}): Recommendation {
    return {
        cropId: 'onion',
        name: 'Onion',
        category: 'Vegetable',
        score: 60,
        expectedProfit: 8000,
        confidenceScore: 0.7,
        predictedTrend: 'Falling',
        currentPrice: 1800,
        bestSeason: 'Kharif',
        growthDuration: 90,
        confidenceBand: 'Medium',
        probFalling: 0.6,
        probRising: 0.1,
        probStable: 0.3,
        predictedPrice: 1530,
        reasoning: {
            summary: 'Despite a falling trend, this crop is still projected to be profitable based on current costs and yield.',
            factors: [
                {
                    factor: 'Price trend',
                    detail: 'The forecast model predicts a falling price trend for this crop over the next 7 days.',
                    direction: 'risk',
                },
                {
                    factor: 'Forecast confidence',
                    detail: 'Model confidence in this trend is 70% (Medium).',
                    direction: 'informational',
                },
                {
                    factor: 'Expected profit',
                    detail: 'Estimated profit is ₹8,000 per acre at a projected price of ₹1,530 (current price ₹1,800).',
                    direction: 'positive',
                },
            ],
            limitations: ['Farm-specific soil suitability is not yet included in this recommendation.'],
        },
        ...overrides,
    };
}

function stableAndProfitable(overrides: Partial<Recommendation> = {}): Recommendation {
    return {
        cropId: 'rice',
        name: 'Rice',
        category: 'Cereal',
        score: 55,
        expectedProfit: 5000,
        confidenceScore: 0.6,
        predictedTrend: 'Stable',
        currentPrice: 1600,
        bestSeason: 'Kharif',
        growthDuration: 150,
        confidenceBand: 'Medium',
        probFalling: 0.2,
        probRising: 0.2,
        probStable: 0.6,
        predictedPrice: 1600,
        reasoning: {
            summary: 'With a stable price trend, this crop is projected to remain profitable based on current costs and yield.',
            factors: [
                {
                    factor: 'Price trend',
                    detail: 'The forecast model predicts a stable price trend for this crop over the next 7 days.',
                    direction: 'informational',
                },
                {
                    factor: 'Forecast confidence',
                    detail: 'Model confidence in this trend is 60% (Medium).',
                    direction: 'informational',
                },
                {
                    factor: 'Expected profit',
                    detail: 'Estimated profit is ₹5,000 per acre at a projected price of ₹1,600 (current price ₹1,600).',
                    direction: 'positive',
                },
            ],
            limitations: ['Farm-specific soil suitability is not yet included in this recommendation.'],
        },
        ...overrides,
    };
}

function unprofitableLowConfidence(overrides: Partial<Recommendation> = {}): Recommendation {
    return {
        cropId: 'tomato',
        name: 'Tomato',
        category: 'Vegetable',
        score: 20,
        expectedProfit: -3000,
        confidenceScore: 0.3,
        predictedTrend: 'Falling',
        currentPrice: 900,
        bestSeason: 'Kharif',
        growthDuration: 75,
        confidenceBand: 'Low',
        probFalling: 0.6,
        probRising: 0.1,
        probStable: 0.3,
        predictedPrice: 765,
        reasoning: {
            summary: 'Despite a falling trend, this crop is not projected to be profitable at current costs.',
            factors: [
                {
                    factor: 'Price trend',
                    detail: 'The forecast model predicts a falling price trend for this crop over the next 7 days.',
                    direction: 'risk',
                },
                {
                    factor: 'Forecast confidence',
                    detail: 'Model confidence in this trend is 30% (Low).',
                    direction: 'risk',
                },
                {
                    factor: 'Expected loss',
                    detail: 'This crop is projected to lose ₹3,000 per acre at a projected price of ₹765 (current price ₹900).',
                    direction: 'risk',
                },
            ],
            limitations: [
                'Farm-specific soil suitability is not yet included in this recommendation.',
                'Forecast confidence is low — treat this prediction with extra caution.',
            ],
        },
        ...overrides,
    };
}

describe('RecommendationsPage — Full reasoning', () => {
    it('renders a "Full reasoning" toggle for the top pick and for every ranked row, not only the top', async () => {
        mockedGetRecommendations.mockResolvedValue([rising(), fallingButProfitable(), stableAndProfitable()]);
        render(<RecommendationsPage />);

        await screen.findAllByText('Wheat');

        // Top pick toggle + one toggle per table row (3 crops => 4 toggles total).
        expect(screen.getAllByRole('button', { name: /full reasoning/i })).toHaveLength(4);
    });

    it('expanding one recommendation shows reasoning for that exact crop only', async () => {
        mockedGetRecommendations.mockResolvedValue([rising(), fallingButProfitable()]);
        render(<RecommendationsPage />);

        await screen.findAllByText('Wheat');

        const table = screen.getByRole('table');
        const onionRow = within(table).getByText('Onion').closest('tr') as HTMLElement;
        const onionToggle = within(onionRow).getByRole('button', { name: /show full reasoning for onion/i });
        fireEvent.click(onionToggle);

        expect(
            screen.getByText('Despite a falling trend, this crop is still projected to be profitable based on current costs and yield.')
        ).toBeTruthy();
        // Wheat's row-level reasoning was never expanded.
        expect(
            screen.queryByText('A rising trend with high confidence supports a projected profit.')
        ).toBeNull();

        expect(onionToggle.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByRole('button', { name: /hide full reasoning for onion/i })).toBeTruthy();
    });

    it('handles a Rising trend: positive trend factor, confidence, and profit reasoning', async () => {
        // A single-item response means the crop is both the "top pick" and
        // the sole table row, each with its own toggle wired to the same
        // cropId key — clicking either expands both, so assertions below use
        // getAllByText/getAllByRole rather than assuming a single match.
        mockedGetRecommendations.mockResolvedValue([rising()]);
        render(<RecommendationsPage />);

        await screen.findAllByText('Wheat');
        fireEvent.click(screen.getAllByRole('button', { name: /show full reasoning for wheat/i })[0] as HTMLElement);

        expect(screen.getAllByText(/predicts a rising price trend/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/model confidence in this trend is 90%/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/estimated profit is ₹15,000 per acre/i).length).toBeGreaterThan(0);
        expect(screen.getByText('High confidence')).toBeTruthy();
    });

    it('honestly explains a Falling trend that is still profitable, without implying the trend caused the profit', async () => {
        mockedGetRecommendations.mockResolvedValue([fallingButProfitable()]);
        render(<RecommendationsPage />);

        await screen.findAllByText('Onion');
        fireEvent.click(screen.getAllByRole('button', { name: /show full reasoning for onion/i })[0] as HTMLElement);

        expect(
            screen.getAllByText('Despite a falling trend, this crop is still projected to be profitable based on current costs and yield.').length
        ).toBeGreaterThan(0);
        expect(screen.getAllByText(/predicts a falling price trend/i).length).toBeGreaterThan(0);
    });

    it('uses neutral (non-"despite") wording for a profitable Stable trend', async () => {
        mockedGetRecommendations.mockResolvedValue([stableAndProfitable()]);
        render(<RecommendationsPage />);

        await screen.findAllByText('Rice');
        fireEvent.click(screen.getAllByRole('button', { name: /show full reasoning for rice/i })[0] as HTMLElement);

        const summaries = screen.getAllByText(/stable price trend, this crop is projected to remain profitable/i);
        expect(summaries.length).toBeGreaterThan(0);
        for (const summary of summaries) {
            expect(summary.textContent?.toLowerCase()).not.toContain('despite');
        }
    });

    it('honestly reports when no crop is profitable, flags low confidence, and never fabricates soil analysis', async () => {
        mockedGetRecommendations.mockResolvedValue([unprofitableLowConfidence()]);
        render(<RecommendationsPage />);

        await screen.findAllByText('Tomato');

        expect(screen.getByText(/No crop currently shows a positive expected profit/i)).toBeTruthy();
        expect(screen.getByText('Best available (no profitable option)')).toBeTruthy();
        expect(screen.getByText('No profitable option')).toBeTruthy();

        fireEvent.click(screen.getAllByRole('button', { name: /show full reasoning for tomato/i })[0] as HTMLElement);

        expect(
            screen.getAllByText('Despite a falling trend, this crop is not projected to be profitable at current costs.').length
        ).toBeGreaterThan(0);
        expect(screen.getAllByText(/projected to lose ₹3,000 per acre/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText('Farm-specific soil suitability is not yet included in this recommendation.').length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Forecast confidence is low/i).length).toBeGreaterThan(0);
    });

    it('rounds and displays the trend probability breakdown correctly', async () => {
        mockedGetRecommendations.mockResolvedValue([rising()]);
        render(<RecommendationsPage />);

        await screen.findAllByText('Wheat');
        fireEvent.click(screen.getAllByRole('button', { name: /show full reasoning for wheat/i })[0] as HTMLElement);

        expect(screen.getAllByText('Trend probability breakdown').length).toBeGreaterThan(0);
        expect(screen.getAllByLabelText('Rising probability 90%').length).toBeGreaterThan(0);
        expect(screen.getAllByLabelText('Falling probability 5%').length).toBeGreaterThan(0);
        expect(screen.getAllByLabelText('Stable probability 5%').length).toBeGreaterThan(0);
    });

    it('preserves the current recommendation values, ranking, and location context alongside the reasoning UI', async () => {
        mockedGetRecommendations.mockResolvedValue([rising(), fallingButProfitable()]);
        render(<RecommendationsPage />);

        await screen.findAllByText('Wheat');

        expect(screen.getByText('Ranked for Warangal, Telangana based on price trend signals and MSP margins.')).toBeTruthy();
        expect(screen.getAllByText('₹15,000').length).toBeGreaterThan(0);
        expect(screen.getByText('Top pick')).toBeTruthy();
        expect(mockedGetRecommendations).toHaveBeenCalledWith('Telangana', 'Warangal', expect.anything());
    });
});
