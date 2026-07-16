import type { Request, Response } from 'express';
import { z } from 'zod';
import { RecommendationService } from '../services/recommendation.service.js';

const recommendationService = new RecommendationService();

const nonEmpty = z.string().trim().min(1, 'must not be empty');

const locationQuerySchema = z.object({
  state: nonEmpty,
  district: nonEmpty,
});

const analysisQuerySchema = z.object({
  commodity: nonEmpty,
  state: nonEmpty,
});

function formatIssues(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join('.') || 'query'}: ${issue.message}`);
}

export class RecommendationController {
  async getRecommendations(req: Request, res: Response) {
    const parsed = locationQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: formatIssues(parsed.error) });
    }

    try {
      const recommendations = await recommendationService.getRecommendations(parsed.data.state, parsed.data.district);
      res.json(recommendations);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async getMarketAnalysis(req: Request, res: Response) {
    const parsed = analysisQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: formatIssues(parsed.error) });
    }

    try {
      const analysis = await recommendationService.getMarketAnalysis(parsed.data.commodity, parsed.data.state);
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
