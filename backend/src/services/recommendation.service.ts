import { getForecastRepository } from '../repositories/forecastRepositoryFactory.js';
import type { ForecastRepository } from '../repositories/forecastRepository.js';
import { STATIC_CROPS } from '../lib/staticData.js';

/**
 * Explainability types for the "Full Reasoning" feature. These are additive
 * to the Recommendation response shape — every field here is derived only
 * from signals the scoring/profit logic below actually uses (trend,
 * confidence, class probabilities, price). Nothing here references soil,
 * season, or any signal the current implementation doesn't read.
 */
export type ReasoningDirection = 'positive' | 'risk' | 'informational';

export interface ReasoningFactor {
  factor: string;
  detail: string;
  direction: ReasoningDirection;
}

export interface RecommendationReasoning {
  summary: string;
  factors: ReasoningFactor[];
  limitations: string[];
}

const SOIL_LIMITATION_NOTE = 'Farm-specific soil suitability is not yet included in this recommendation.';

function formatRupees(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

/**
 * Builds a deterministic, structured explanation from the same signals
 * getRecommendations() already used to compute score/expectedProfit above —
 * no new data source, no fabricated factor. Season/growth-duration are
 * deliberately excluded: they're displayed elsewhere but never feed the
 * score or profit formula, so claiming them as a "reason" would misrepresent
 * what the ranking actually did.
 */
function buildReasoning(params: {
  predictedPriceTrend: string;
  confidence: number;
  confidenceBand: string;
  currentModalPrice: number;
  expectedPrice: number;
  expectedProfit: number;
}): RecommendationReasoning {
  const { predictedPriceTrend, confidence, confidenceBand, currentModalPrice, expectedPrice, expectedProfit } = params;

  const factors: ReasoningFactor[] = [];

  const trendDirection: ReasoningDirection =
    predictedPriceTrend === 'Rising' ? 'positive' : predictedPriceTrend === 'Falling' ? 'risk' : 'informational';
  factors.push({
    factor: 'Price trend',
    detail: `The forecast model predicts a ${predictedPriceTrend.toLowerCase()} price trend for this crop over the next 7 days.`,
    direction: trendDirection,
  });

  const confidenceDirection: ReasoningDirection =
    confidenceBand === 'High' ? 'positive' : confidenceBand === 'Low' ? 'risk' : 'informational';
  factors.push({
    factor: 'Forecast confidence',
    detail: `Model confidence in this trend is ${Math.round(confidence * 100)}% (${confidenceBand}).`,
    direction: confidenceDirection,
  });

  const isProfitable = expectedProfit > 0;
  factors.push({
    factor: isProfitable ? 'Expected profit' : 'Expected loss',
    detail: isProfitable
      ? `Estimated profit is ${formatRupees(expectedProfit)} per acre at a projected price of ${formatRupees(expectedPrice)} (current price ${formatRupees(currentModalPrice)}).`
      : `This crop is projected to lose ${formatRupees(Math.abs(expectedProfit))} per acre at a projected price of ${formatRupees(expectedPrice)} (current price ${formatRupees(currentModalPrice)}).`,
    direction: isProfitable ? 'positive' : 'risk',
  });

  const limitations: string[] = [SOIL_LIMITATION_NOTE];
  if (confidenceBand !== 'High') {
    limitations.push(`Forecast confidence is ${confidenceBand.toLowerCase()} — treat this prediction with extra caution.`);
  }

  // Profitability and trend direction can disagree (e.g. a Falling trend can
  // still leave yield*price above cost) — the summary must not imply the
  // trend caused a profit it didn't support, so the two are phrased
  // independently rather than assuming "profitable" means "the trend helped".
  // A Stable trend is neither a tailwind nor a headwind, so it gets neutral
  // wording rather than "despite", which is reserved for the genuine
  // Falling-but-profitable case.
  let summary: string;
  if (!isProfitable) {
    summary = `Despite a ${predictedPriceTrend.toLowerCase()} trend, this crop is not projected to be profitable at current costs.`;
  } else if (trendDirection === 'positive') {
    summary = `A ${predictedPriceTrend.toLowerCase()} trend with ${confidenceBand.toLowerCase()} confidence supports a projected profit.`;
  } else if (trendDirection === 'informational') {
    summary = `With a ${predictedPriceTrend.toLowerCase()} price trend, this crop is projected to remain profitable based on current costs and yield.`;
  } else {
    summary = `Despite a ${predictedPriceTrend.toLowerCase()} trend, this crop is still projected to be profitable based on current costs and yield.`;
  }

  return { summary, factors, limitations };
}

// How much expected profit (in rupees) contributes to the within-bucket
// ranking tie-break, expressed as rank-score points per rupee. At this
// scale, profit differences of a few thousand rupees shift the ranking by
// a few points, while the 0-100 trend/confidence `score` still dominates
// for typical profit spreads — profit breaks close ties or reinforces a
// clear score lead, it doesn't overwhelm trend/confidence outright. Only
// the profit *sign* is an absolute gate (see rankRecommendations below).
const PROFIT_RANK_SCALE = 1000;
const PROFIT_RANK_WEIGHT = 0.5;

interface RankableRecommendation {
  score: number;
  expectedProfit: number;
}

function rankScore(rec: RankableRecommendation): number {
  return rec.score + (rec.expectedProfit / PROFIT_RANK_SCALE) * PROFIT_RANK_WEIGHT;
}

/**
 * Ranks recommendations so that any crop with positive expected profit
 * always outranks every crop with negative (or zero) expected profit,
 * regardless of trend/confidence score — a crop that's projected to lose
 * money should never be the "top pick" while a profitable option exists.
 * Within each profit-sign bucket, ordering blends the existing
 * trend/confidence score with expected profit via rankScore() above, so
 * confidence and trend still matter, and (when every option is
 * unprofitable) the least-bad option surfaces first.
 */
function rankRecommendations<T extends RankableRecommendation>(recommendations: T[]): T[] {
  return [...recommendations].sort((a, b) => {
    const aPositive = a.expectedProfit > 0;
    const bPositive = b.expectedProfit > 0;
    if (aPositive !== bPositive) return aPositive ? -1 : 1;
    return rankScore(b) - rankScore(a);
  });
}

/**
 * Recommendation scoring, driven by the local CSV-backed forecast provider
 * and the static crop reference list (see staticData.ts). Same scoring
 * logic as the previous Prisma-backed implementation; only the data source
 * changed. prisma/schema.prisma and prisma/seed.ts are untouched.
 */
export class RecommendationService {
  // Lazily resolved per call — see forecast.service.ts for why this can't
  // be captured in the constructor (module-load-time instantiation in
  // recommendation.controller.ts happens before startup initialization runs).
  private readonly override?: ForecastRepository | undefined;

  constructor(repository?: ForecastRepository) {
    this.override = repository;
  }

  private repo(): ForecastRepository {
    return this.override ?? getForecastRepository();
  }

  async getRecommendations(state: string, district: string) {
    const crops = STATIC_CROPS;

    // Fetch every crop's forecasts concurrently rather than one at a time:
    // under CsvForecastRepository this was always an in-memory Map lookup
    // (sequential cost was negligible), but under PostgresForecastRepository
    // each call is a real DB round trip, and this loop runs on every
    // /api/recommendations request — issuing them in parallel turns ~12
    // sequential round trips into 1 round trip's worth of wall-clock time.
    const forecastsByCrop = await Promise.all(crops.map((crop) => this.repo().getAllLatest(crop.name)));

    const recommendations = [];

    for (let i = 0; i < crops.length; i++) {
      const crop = crops[i]!;
      const cropForecasts = forecastsByCrop[i]!;

      // Find the latest forecast for this crop in the specified location
      // We first try district, then fall back to state-wide average if needed
      let forecast = cropForecasts.find(
        (f) => f.state.toLowerCase() === state.toLowerCase() && f.district.toLowerCase() === district.toLowerCase()
      );

      if (!forecast) {
        // Fallback to state-wide latest forecast for this commodity
        forecast = cropForecasts
          .filter((f) => f.state.toLowerCase() === state.toLowerCase())
          .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
      }

      if (forecast) {
        /**
         * Scoring logic based on Forecasting Document:
         * - priceTrendScore (range -1.0 to 1.0): High is better.
         * - confidence (range 0.0 to 1.0): High is better.
         *
         * Score = ((priceTrendScore + 1) / 2 * 0.7 + (confidence * 0.3)) * 100
         */
        const normalizedTrendScore = (forecast.priceTrendScore + 1) / 2;
        const score = (normalizedTrendScore * 0.7 + forecast.confidence * 0.3) * 100;

        /**
         * Profit Estimation:
         * Profit = (Expected Price * Yield) - Cost
         * Expected Price is adjusted by the predicted trend.
         */
        const trendMultiplier = forecast.predictedPriceTrend === 'Rising' ? 1.15 : (forecast.predictedPriceTrend === 'Falling' ? 0.85 : 1.0);
        const expectedPrice = forecast.currentModalPrice * trendMultiplier;
        const typicalYield = crop.typicalYield || 10; // default to 10 quintals/acre
        const cost = crop.costOfCultivation || 15000; // default cost

        const expectedProfit = (expectedPrice * typicalYield) - cost;

        recommendations.push({
          cropId: crop.id,
          name: crop.name,
          category: crop.category,
          score: Math.round(score * 100) / 100,
          expectedProfit: Math.round(expectedProfit * 100) / 100,
          confidenceScore: forecast.confidence,
          predictedTrend: forecast.predictedPriceTrend,
          currentPrice: forecast.currentModalPrice,
          bestSeason: crop.bestSeason,
          growthDuration: crop.growthDuration,
          confidenceBand: forecast.confidenceBand,
          probFalling: forecast.probFalling,
          probRising: forecast.probRising,
          probStable: forecast.probStable,
          predictedPrice: Math.round(expectedPrice * 100) / 100,
          reasoning: buildReasoning({
            predictedPriceTrend: forecast.predictedPriceTrend,
            confidence: forecast.confidence,
            confidenceBand: forecast.confidenceBand,
            currentModalPrice: forecast.currentModalPrice,
            expectedPrice,
            expectedProfit,
          }),
        });
      }
    }

    // Positive-profit crops always rank above negative-profit crops; within
    // each bucket, ranking blends trend/confidence score with profit.
    return rankRecommendations(recommendations);
  }

  async getMarketAnalysis(commodity: string, state: string) {
    // Aggregate data for a commodity across markets in a state
    const allForecasts = await this.repo().getAllLatest(commodity);
    const forecasts = allForecasts.filter((f) => f.state.toLowerCase() === state.toLowerCase());

    const totalMarkets = forecasts.length;
    const risingMarkets = forecasts.filter((f) => f.predictedPriceTrend === 'Rising').length;
    const fallingMarkets = forecasts.filter((f) => f.predictedPriceTrend === 'Falling').length;
    const stableMarkets = forecasts.filter((f) => f.predictedPriceTrend === 'Stable').length;

    const avgPrice = forecasts.reduce((sum, f) => sum + f.currentModalPrice, 0) / (totalMarkets || 1);

    return {
      commodity,
      state,
      totalMarkets,
      risingMarkets,
      fallingMarkets,
      stableMarkets,
      avgPrice: Math.round(avgPrice * 100) / 100,
      marketSentiment: risingMarkets > fallingMarkets ? 'Bullish' : (fallingMarkets > risingMarkets ? 'Bearish' : 'Neutral'),
    };
  }
}
