import type { Request, Response } from 'express';
import { z } from 'zod';
import { ForecastService } from '../services/forecast.service.js';
import { listAvailableCommodities } from '../lib/csvForecastIndex.js';

const forecastService = new ForecastService();

const nonEmpty = z.string().trim().min(1, 'must not be empty');

const locationQuerySchema = z.object({
  commodity: nonEmpty,
  state: nonEmpty,
  district: nonEmpty,
  market: nonEmpty,
});

const optionalCommodityQuerySchema = z.object({
  commodity: nonEmpty.optional(),
});

// state/district on /forecast/all-latest are an optional *pair*: passing
// only one would be ambiguous (which district in which state?), so both or
// neither is enforced here rather than silently ignoring a lone param.
const allLatestQuerySchema = z
  .object({
    commodity: nonEmpty.optional(),
    state: nonEmpty.optional(),
    district: nonEmpty.optional(),
  })
  .refine((v) => (v.state == null) === (v.district == null), {
    message: 'state and district must be provided together',
    path: ['district'],
  });

function formatIssues(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join('.') || 'query'}: ${issue.message}`);
}

export class ForecastController {
  async getLatest(req: Request, res: Response) {
    const parsed = locationQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: formatIssues(parsed.error) });
    }
    const { commodity, state, district, market } = parsed.data;

    try {
      const result = await forecastService.getLatestForecast(commodity, state, district, market);

      if (!result) {
        return res.status(404).json({
          error: `No forecast found for ${commodity} in ${state} / ${district} / ${market}`,
          availableCommodities: listAvailableCommodities(),
        });
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async getAllLatest(req: Request, res: Response) {
    const parsed = allLatestQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: formatIssues(parsed.error) });
    }

    try {
      const { commodity, state, district } = parsed.data;
      const results = await forecastService.getAllLatestForecasts(commodity, state, district);
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
    const parsed = optionalCommodityQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: formatIssues(parsed.error) });
    }

    try {
      const markets = await forecastService.listAvailableMarkets(parsed.data.commodity);
      res.json(markets);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async getLocations(req: Request, res: Response) {
    try {
      const locations = await forecastService.listAvailableLocations();
      res.json(locations);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async getHistory(req: Request, res: Response) {
    const parsed = locationQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: formatIssues(parsed.error) });
    }
    const { commodity, state, district, market } = parsed.data;

    try {
      const history = await forecastService.getPriceHistory(commodity, state, district, market);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
