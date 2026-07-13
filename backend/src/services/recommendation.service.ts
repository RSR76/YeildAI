import prisma from '../lib/prisma.js';

export class RecommendationService {
  async getRecommendations(state: string, district: string) {
    // 1. Get all crops from the database
    const crops = await prisma.crop.findMany();
    
    const recommendations = [];

    for (const crop of crops) {
      // Find the latest forecast for this crop in the specified location
      // We first try district, then fall back to state-wide average if needed
      let forecast = await prisma.forecast.findFirst({
        where: {
          commodity: { equals: crop.name, mode: 'insensitive' },
          state: { equals: state, mode: 'insensitive' },
          district: { equals: district, mode: 'insensitive' },
        },
        orderBy: { date: 'desc' },
      });

      if (!forecast) {
        // Fallback to state-wide latest forecast for this commodity
        forecast = await prisma.forecast.findFirst({
          where: {
            commodity: { equals: crop.name, mode: 'insensitive' },
            state: { equals: state, mode: 'insensitive' },
          },
          orderBy: { date: 'desc' },
        });
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

    // Sort by score descending
    return recommendations.sort((a, b) => b.score - a.score);
  }

  async getMarketAnalysis(commodity: string, state: string) {
    // Aggregate data for a commodity across markets in a state
    const forecasts = await prisma.forecast.findMany({
      where: {
        commodity: { equals: commodity, mode: 'insensitive' },
        state: { equals: state, mode: 'insensitive' },
      },
      distinct: ['market'],
      orderBy: { date: 'desc' },
    });

    const totalMarkets = forecasts.length;
    const risingMarkets = forecasts.filter((f: any) => f.predictedPriceTrend === 'Rising').length;
    const fallingMarkets = forecasts.filter((f: any) => f.predictedPriceTrend === 'Falling').length;
    const stableMarkets = forecasts.filter((f: any) => f.predictedPriceTrend === 'Stable').length;

    const avgPrice = forecasts.reduce((sum: number, f: any) => sum + f.currentModalPrice, 0) / (totalMarkets || 1);

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
