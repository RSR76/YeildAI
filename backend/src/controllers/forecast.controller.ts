import type { Request, Response } from 'express';
import { ForecastService } from '../services/forecast.service.js';

const forecastService = new ForecastService();

export class ForecastController {
  async getLatest(req: Request, res: Response) {
    const { commodity, state, district, market } = req.query;
    if (!commodity || !state || !district || !market) {
      return res.status(400).json({ error: 'commodity, state, district, and market are required' });
    }

    try {
      const result = await forecastService.getLatestForecast(
        commodity as string,
        state as string,
        district as string,
        market as string
      );

      if (!result) {
        return res.status(404).json({ error: 'No forecast found' });
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async getAllLatest(req: Request, res: Response) {
    const { commodity } = req.query;
    try {
      const results = await forecastService.getAllLatestForecasts(commodity as string);
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async getCommodities(req: Request, res: Response) {
    try {
      const commodities = await forecastService.listAvailableCommodities();
      res.json(commodities);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async getMarkets(req: Request, res: Response) {
    const { commodity } = req.query;
    try {
      const markets = await forecastService.listAvailableMarkets(commodity as string);
      res.json(markets);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async getHistory(req: Request, res: Response) {
    const { commodity, state, district, market } = req.query;
    if (!commodity || !state || !district || !market) {
      return res.status(400).json({ error: 'commodity, state, district, and market are required' });
    }

    try {
      const history = await forecastService.getPriceHistory(
        commodity as string,
        state as string,
        district as string,
        market as string
      );
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
