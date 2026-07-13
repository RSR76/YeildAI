export declare class RecommendationService {
    getRecommendations(state: string, district: string): Promise<{
        cropId: string;
        name: string;
        category: string | null;
        score: number;
        expectedProfit: number;
        confidenceScore: number;
        predictedTrend: string;
        currentPrice: number;
        bestSeason: string | null;
        growthDuration: number | null;
    }[]>;
    getMarketAnalysis(commodity: string, state: string): Promise<{
        commodity: string;
        state: string;
        totalMarkets: number;
        risingMarkets: number;
        fallingMarkets: number;
        stableMarkets: number;
        avgPrice: number;
        marketSentiment: string;
    }>;
}
//# sourceMappingURL=recommendation.service.d.ts.map