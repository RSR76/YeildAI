import prisma from '../lib/prisma.js';
export class ForecastService {
    async getLatestForecast(commodity, state, district, market) {
        return prisma.forecast.findFirst({
            where: {
                commodity: { equals: commodity, mode: 'insensitive' },
                state: { equals: state, mode: 'insensitive' },
                district: { equals: district, mode: 'insensitive' },
                market: { equals: market, mode: 'insensitive' },
            },
            orderBy: { date: 'desc' },
        });
    }
    async getAllLatestForecasts(commodity) {
        // This is more complex in SQL. We need the latest date for each market.
        // For simplicity in MVP, we can fetch all and group or use a raw query.
        // Or we can use distinct on commodity, state, district, market.
        return prisma.forecast.findMany({
            where: commodity ? { commodity: { equals: commodity, mode: 'insensitive' } } : {},
            distinct: ['commodity', 'state', 'district', 'market'],
            orderBy: { date: 'desc' },
        });
    }
    async listAvailableCommodities() {
        const result = await prisma.forecast.findMany({
            distinct: ['commodity'],
            select: { commodity: true },
            orderBy: { commodity: 'asc' },
        });
        return result.map((r) => r.commodity);
    }
    async listAvailableMarkets(commodity) {
        return prisma.forecast.findMany({
            where: commodity ? { commodity: { equals: commodity, mode: 'insensitive' } } : {},
            distinct: ['commodity', 'state', 'district', 'market'],
            select: {
                commodity: true,
                state: true,
                district: true,
                market: true,
            },
        });
    }
    async getPriceHistory(commodity, state, district, market) {
        return prisma.forecast.findMany({
            where: {
                commodity: { equals: commodity, mode: 'insensitive' },
                state: { equals: state, mode: 'insensitive' },
                district: { equals: district, mode: 'insensitive' },
                market: { equals: market, mode: 'insensitive' },
            },
            orderBy: { date: 'asc' },
        });
    }
}
//# sourceMappingURL=forecast.service.js.map