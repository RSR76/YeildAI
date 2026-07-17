import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import * as csvForecastIndex from '../src/lib/csvForecastIndex.js';
import { RecommendationService } from '../src/services/recommendation.service.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(here, 'fixtures/sample_lookup.csv');

beforeAll(() => {
  csvForecastIndex.__resetForTests(fixturePath);
});

describe('RecommendationService.getRecommendations', () => {
  it('scores only crops with an available forecast for the requested location', async () => {
    const service = new RecommendationService();
    const recommendations = await service.getRecommendations('Uttar Pradesh', 'Barabanki');

    // The fixture only has a Tomato forecast for Uttar Pradesh/Barabanki;
    // Potato/Rice/Wheat/Onion have no matching forecast and must be skipped
    // rather than fabricated.
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]?.name).toBe('Tomato');

    // Score = ((priceTrendScore + 1) / 2 * 0.7 + confidence * 0.3) * 100
    // = ((0.90 + 1) / 2 * 0.7 + 0.96 * 0.3) * 100 = 95.3
    expect(recommendations[0]?.score).toBeCloseTo(95.3, 2);

    // expectedPrice = 860 * 1.15 (Rising) = 989; profit = 989*10 - 15000
    expect(recommendations[0]?.expectedProfit).toBeCloseTo(-5110, 2);
  });
});

describe('RecommendationService.getMarketAnalysis', () => {
  it('aggregates sentiment across markets for a commodity/state', async () => {
    const service = new RecommendationService();
    const analysis = await service.getMarketAnalysis('Onion', 'Maharashtra');

    expect(analysis.totalMarkets).toBe(1);
    expect(analysis.stableMarkets).toBe(1);
    expect(analysis.avgPrice).toBe(1210);
    expect(analysis.marketSentiment).toBe('Neutral');
  });
});

describe('RecommendationService ranking (profit-aware)', () => {
  const rankingFixturePath = path.resolve(here, 'fixtures/ranking_lookup.csv');

  beforeAll(() => {
    csvForecastIndex.__resetForTests(rankingFixturePath);
  });

  it('ranks a positive-profit crop above a negative-profit crop even when the negative one has a much higher score', async () => {
    const service = new RecommendationService();
    const recommendations = await service.getRecommendations('Rank State A', 'Rank District A');

    expect(recommendations).toHaveLength(2);
    // Tomato: Falling trend but a very high trend/confidence score (95.0) —
    // yet its expected profit is negative (-6500).
    // Onion: Rising trend, much lower score (53.5) — but positive profit (+21400).
    const tomato = recommendations.find((r) => r.name === 'Tomato');
    const onion = recommendations.find((r) => r.name === 'Onion');
    expect(tomato?.expectedProfit).toBeLessThan(0);
    expect(onion?.expectedProfit).toBeGreaterThan(0);
    expect(tomato && tomato.score).toBeGreaterThan(onion?.score ?? 0);

    // Despite Tomato's higher score, Onion (profitable) must rank first.
    expect(recommendations[0]?.name).toBe('Onion');
    expect(recommendations[0]?.expectedProfit).toBeGreaterThan(0);
  });

  it('still uses trend/confidence score to order two profitable crops, not just raw profit', async () => {
    const service = new RecommendationService();
    const recommendations = await service.getRecommendations('Rank State B', 'Rank District B');

    expect(recommendations).toHaveLength(2);
    const wheat = recommendations.find((r) => r.name === 'Wheat');
    const rice = recommendations.find((r) => r.name === 'Rice');
    // Both profitable, but Rice has the higher raw profit.
    expect(wheat?.expectedProfit).toBeGreaterThan(0);
    expect(rice?.expectedProfit).toBeGreaterThan(0);
    expect(rice && wheat && rice.expectedProfit).toBeGreaterThan(wheat!.expectedProfit);

    // Wheat's much higher trend/confidence score still wins the ranking.
    expect(recommendations[0]?.name).toBe('Wheat');
  });

  it('when every option is unprofitable, surfaces the least-bad one first and keeps it negative (no fabricated profit)', async () => {
    const service = new RecommendationService();
    const recommendations = await service.getRecommendations('Rank State C', 'Rank District C');

    expect(recommendations).toHaveLength(2);
    expect(recommendations.every((r) => r.expectedProfit < 0)).toBe(true);

    // Potato loses less and has a better score than Onion in this location.
    expect(recommendations[0]?.name).toBe('Potato');
    expect(recommendations[0]?.expectedProfit).toBeLessThan(0);
    expect(recommendations[0]!.expectedProfit).toBeGreaterThan(recommendations[1]!.expectedProfit);
  });
});
