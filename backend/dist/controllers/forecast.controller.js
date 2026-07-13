import { ForecastService } from '../services/forecast.service.js';
const forecastService = new ForecastService();
export class ForecastController {
    async getLatest(req, res) {
        const { commodity, state, district, market } = req.query;
        if (!commodity || !state || !district || !market) {
            return res.status(400).json({ error: 'commodity, state, district, and market are required' });
        }
        try {
            const result = await forecastService.getLatestForecast(commodity, state, district, market);
            if (!result) {
                return res.status(404).json({ error: 'No forecast found' });
            }
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async getAllLatest(req, res) {
        const { commodity } = req.query;
        try {
            const results = await forecastService.getAllLatestForecasts(commodity);
            res.json(results);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async getCommodities(req, res) {
        try {
            const commodities = await forecastService.listAvailableCommodities();
            res.json(commodities);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async getMarkets(req, res) {
        const { commodity } = req.query;
        try {
            const markets = await forecastService.listAvailableMarkets(commodity);
            res.json(markets);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async getHistory(req, res) {
        const { commodity, state, district, market } = req.query;
        if (!commodity || !state || !district || !market) {
            return res.status(400).json({ error: 'commodity, state, district, and market are required' });
        }
        try {
            const history = await forecastService.getPriceHistory(commodity, state, district, market);
            res.json(history);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}
//# sourceMappingURL=forecast.controller.js.map