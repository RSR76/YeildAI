export declare class ForecastService {
    getLatestForecast(commodity: string, state: string, district: string, market: string): Promise<{
        id: string;
        commodity: string;
        state: string;
        district: string;
        market: string;
        date: Date;
        currentModalPrice: number;
        predictedPriceTrend: string;
        confidence: number;
        confidenceBand: string;
        priceTrendScore: number;
        probFalling: number;
        probRising: number;
        probStable: number;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    getAllLatestForecasts(commodity?: string): Promise<{
        id: string;
        commodity: string;
        state: string;
        district: string;
        market: string;
        date: Date;
        currentModalPrice: number;
        predictedPriceTrend: string;
        confidence: number;
        confidenceBand: string;
        priceTrendScore: number;
        probFalling: number;
        probRising: number;
        probStable: number;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    listAvailableCommodities(): Promise<any[]>;
    listAvailableMarkets(commodity?: string): Promise<{
        commodity: string;
        district: string;
        market: string;
        state: string;
    }[]>;
    getPriceHistory(commodity: string, state: string, district: string, market: string): Promise<{
        id: string;
        commodity: string;
        state: string;
        district: string;
        market: string;
        date: Date;
        currentModalPrice: number;
        predictedPriceTrend: string;
        confidence: number;
        confidenceBand: string;
        priceTrendScore: number;
        probFalling: number;
        probRising: number;
        probStable: number;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
}
//# sourceMappingURL=forecast.service.d.ts.map