import * as csvForecastIndex from '../lib/csvForecastIndex.js';
import { STATIC_CROPS } from '../lib/staticData.js';

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
  async getRecommendations(state: string, district: string) {
    const crops = STATIC_CROPS;

    const recommendations = [];

    for (const crop of crops) {
      const cropForecasts = csvForecastIndex.getAllLatestForecasts(crop.name);

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
        });
      }
    }

    // Positive-profit crops always rank above negative-profit crops; within
    // each bucket, ranking blends trend/confidence score with profit.
    return rankRecommendations(recommendations);
  }

  async getMarketAnalysis(commodity: string, state: string) {
    // Aggregate data for a commodity across markets in a state
    const forecasts = csvForecastIndex
      .getAllLatestForecasts(commodity)
      .filter((f) => f.state.toLowerCase() === state.toLowerCase());

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
