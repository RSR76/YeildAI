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

const yearParam = z
  .string()
  .trim()
  .regex(/^\d{4}$/, 'must be a 4-digit year')
  .transform((v) => Number(v));

const yearlyHistoryQuerySchema = locationQuerySchema.extend({ year: yearParam });

// Comma-separated list of 4-digit years, e.g. "2024,2025,2026" — kept as a
// single query param (rather than repeated ?years=2024&years=2025) to match
// how the rest of this API takes flat query strings, and capped at 10 years
// so a client can't force an unbounded number of sequential DB round-trips.
const yearComparisonQuerySchema = locationQuerySchema.extend({
  years: z
    .string()
    .trim()
    .min(1, 'must not be empty')
    .transform((v) => v.split(',').map((y) => y.trim()))
    .refine((years) => years.length > 0 && years.length <= 10, { message: 'must list between 1 and 10 years' })
    .refine((years) => years.every((y) => /^\d{4}$/.test(y)), { message: 'every year must be a 4-digit number' })
    .transform((years) => years.map(Number)),
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

  /** Distinct calendar years with data for a (commodity, market) pair — powers a year selector in the UI. */
  async getYears(req: Request, res: Response) {
    const parsed = locationQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: formatIssues(parsed.error) });
    }
    const { commodity, state, district, market } = parsed.data;

    try {
      const years = await forecastService.listAvailableYears(commodity, state, district, market);
      res.json(years);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  /** Every historical price record for one (commodity, market) pair within a single calendar year. */
  async getYearlyHistory(req: Request, res: Response) {
    const parsed = yearlyHistoryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: formatIssues(parsed.error) });
    }
    const { commodity, state, district, market, year } = parsed.data;

    try {
      const result = await forecastService.getYearlyHistory(commodity, state, district, market, year);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  /** Year-over-year summary (min/max/avg/latest modal price per year). Missing years are reported honestly, not interpolated. */
  async getYearComparison(req: Request, res: Response) {
    const parsed = yearComparisonQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: formatIssues(parsed.error) });
    }
    const { commodity, state, district, market, years } = parsed.data;

    try {
      const comparison = await forecastService.compareYears(commodity, state, district, market, years);
      res.json(comparison);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
