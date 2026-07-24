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

const VALID_DIRECTIONS = ['positive', 'risk', 'informational'];

describe('RecommendationService reasoning', () => {
  const rankingFixturePath = path.resolve(here, 'fixtures/ranking_lookup.csv');

  describe('using the ranking fixture', () => {
    beforeAll(() => {
      csvForecastIndex.__resetForTests(rankingFixturePath);
    });

    it('gives a profitable Rising-trend recommendation a positive trend factor and a positive profit factor', async () => {
      const service = new RecommendationService();
      const recommendations = await service.getRecommendations('Rank State A', 'Rank District A');
      const onion = recommendations.find((r) => r.name === 'Onion');

      expect(onion).toBeDefined();
      expect(onion?.expectedProfit).toBeGreaterThan(0);
      expect(onion?.confidenceBand).toBe('Medium');
      expect(onion?.probRising).toBeCloseTo(0.5, 2);

      const trendFactor = onion?.reasoning?.factors.find((f) => /trend/i.test(f.factor));
      expect(trendFactor?.direction).toBe('positive');
      expect(trendFactor?.detail.toLowerCase()).toContain('rising');

      const profitFactor = onion?.reasoning?.factors.find((f) => /profit|loss/i.test(f.factor));
      expect(profitFactor?.direction).toBe('positive');
    });

    it('gives a negative-profit recommendation a risk-flagged profit factor, even with a high-confidence trend', async () => {
      const service = new RecommendationService();
      const recommendations = await service.getRecommendations('Rank State A', 'Rank District A');
      const tomato = recommendations.find((r) => r.name === 'Tomato');

      expect(tomato).toBeDefined();
      expect(tomato?.expectedProfit).toBeLessThan(0);

      const profitFactor = tomato?.reasoning?.factors.find((f) => /profit|loss/i.test(f.factor));
      expect(profitFactor?.direction).toBe('risk');
      expect(profitFactor?.detail.toLowerCase()).toMatch(/loss|lose/);
    });

    it('never claims a Falling (risk) trend "supports" a profit it merely coexists with', async () => {
      // Wheat in Rank State D: Falling trend, but yield/cost economics still
      // leave expectedProfit positive. The trend factor must stay flagged as
      // risk, and the summary must not imply the trend caused the profit.
      const service = new RecommendationService();
      const recommendations = await service.getRecommendations('Rank State D', 'Rank District D');
      const wheat = recommendations.find((r) => r.name === 'Wheat');

      expect(wheat).toBeDefined();
      expect(wheat?.expectedProfit).toBeGreaterThan(0);

      const trendFactor = wheat?.reasoning?.factors.find((f) => /trend/i.test(f.factor));
      expect(trendFactor?.direction).toBe('risk');

      const profitFactor = wheat?.reasoning?.factors.find((f) => /profit|loss/i.test(f.factor));
      expect(profitFactor?.direction).toBe('positive');

      expect(wheat?.reasoning?.summary.toLowerCase()).not.toMatch(/falling trend.*supports/);
      expect(wheat?.reasoning?.summary.toLowerCase()).toMatch(/^despite a falling trend/);
    });

    it('uses neutral wording (not "despite") for a profitable Stable-trend recommendation', async () => {
      // Wheat in Rank State E: Stable trend, still profitable. A Stable trend
      // is neither a tailwind nor a headwind, so "despite" (reserved for the
      // genuine Falling-but-profitable case) would be misleading here.
      const service = new RecommendationService();
      const recommendations = await service.getRecommendations('Rank State E', 'Rank District E');
      const wheat = recommendations.find((r) => r.name === 'Wheat');

      expect(wheat).toBeDefined();
      expect(wheat?.expectedProfit).toBeGreaterThan(0);

      const trendFactor = wheat?.reasoning?.factors.find((f) => /trend/i.test(f.factor));
      expect(trendFactor?.direction).toBe('informational');

      const summary = wheat?.reasoning?.summary.toLowerCase() ?? '';
      expect(summary).not.toMatch(/despite/);
      expect(summary).toMatch(/^with a stable price trend/);
    });

    it('when every option is unprofitable, still reports the winning option honestly as a loss (no fabricated positive spin)', async () => {
      const service = new RecommendationService();
      const recommendations = await service.getRecommendations('Rank State C', 'Rank District C');
      const winner = recommendations[0];

      expect(winner?.expectedProfit).toBeLessThan(0);
      const profitFactor = winner?.reasoning?.factors.find((f) => /profit|loss/i.test(f.factor));
      expect(profitFactor?.direction).toBe('risk');
    });
  });

  describe('using the sample fixture (Stable trend, Low confidence)', () => {
    beforeAll(() => {
      csvForecastIndex.__resetForTests(fixturePath);
    });

    it('marks a Stable trend as informational and a Low confidence band as a risk factor, and surfaces the probability breakdown', async () => {
      const service = new RecommendationService();
      const recommendations = await service.getRecommendations('Maharashtra', 'Nashik');
      const onion = recommendations.find((r) => r.name === 'Onion');

      expect(onion).toBeDefined();
      expect(onion?.confidenceBand).toBe('Low');
      expect(onion?.probFalling).toBeCloseTo(0.2, 2);
      expect(onion?.probRising).toBeCloseTo(0.2, 2);
      expect(onion?.probStable).toBeCloseTo(0.6, 2);

      const trendFactor = onion?.reasoning?.factors.find((f) => /trend/i.test(f.factor));
      expect(trendFactor?.direction).toBe('informational');

      const confidenceFactor = onion?.reasoning?.factors.find((f) => /confidence/i.test(f.factor));
      expect(confidenceFactor?.direction).toBe('risk');
      expect(onion?.reasoning?.limitations.some((l) => /low.*confidence|confidence.*low/i.test(l))).toBe(true);
    });

    it('excludes crops with no matching forecast rather than fabricating a recommendation for them', async () => {
      const service = new RecommendationService();
      const recommendations = await service.getRecommendations('Uttar Pradesh', 'Barabanki');

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0]?.name).toBe('Tomato');
      expect(recommendations[0]?.reasoning).toBeDefined();
    });
  });

  describe('structure and honesty guarantees', () => {
    beforeAll(() => {
      csvForecastIndex.__resetForTests(rankingFixturePath);
    });

    it('returns a well-typed reasoning object for every recommendation', async () => {
      const service = new RecommendationService();
      const recommendations = await service.getRecommendations('Rank State B', 'Rank District B');

      expect(recommendations.length).toBeGreaterThan(0);
      for (const rec of recommendations) {
        expect(typeof rec.reasoning?.summary).toBe('string');
        expect(rec.reasoning?.summary.length).toBeGreaterThan(0);
        expect(Array.isArray(rec.reasoning?.factors)).toBe(true);
        expect(rec.reasoning?.factors.length).toBeGreaterThan(0);
        for (const factor of rec.reasoning?.factors ?? []) {
          expect(typeof factor.factor).toBe('string');
          expect(typeof factor.detail).toBe('string');
          expect(VALID_DIRECTIONS).toContain(factor.direction);
        }
        expect(Array.isArray(rec.reasoning?.limitations)).toBe(true);
      }
    });

    it('never presents soil suitability as a scored factor, and discloses it as a limitation instead', async () => {
      const service = new RecommendationService();
      const recommendations = await service.getRecommendations('Rank State A', 'Rank District A');

      for (const rec of recommendations) {
        expect(rec.reasoning?.factors.some((f) => /soil/i.test(f.factor) || /soil/i.test(f.detail))).toBe(false);
        expect(rec.reasoning?.limitations.some((l) => /soil/i.test(l))).toBe(true);
      }
    });

    it('keeps class probabilities as valid numbers that sum to ~1 and match the underlying forecast', async () => {
      const service = new RecommendationService();
      const recommendations = await service.getRecommendations('Rank State B', 'Rank District B');

      for (const rec of recommendations) {
        expect(rec.probFalling).toBeGreaterThanOrEqual(0);
        expect(rec.probRising).toBeGreaterThanOrEqual(0);
        expect(rec.probStable).toBeGreaterThanOrEqual(0);
        const sum = (rec.probFalling ?? 0) + (rec.probRising ?? 0) + (rec.probStable ?? 0);
        expect(sum).toBeCloseTo(1, 1);
      }

      const wheat = recommendations.find((r) => r.name === 'Wheat');
      expect(wheat?.probRising).toBeCloseTo(0.9, 2);
      expect(wheat?.probFalling).toBeCloseTo(0.02, 2);
      expect(wheat?.probStable).toBeCloseTo(0.08, 2);
    });
  });
});
