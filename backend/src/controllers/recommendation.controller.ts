import type { Request, Response } from 'express';
import { RecommendationService } from '../services/recommendation.service.js';

const recommendationService = new RecommendationService();

export class RecommendationController {
  async getRecommendations(req: Request, res: Response) {
    const { state, district } = req.query;
    if (!state || !district) {
      return res.status(400).json({ error: 'state and district are required' });
    }

    try {
      const recommendations = await recommendationService.getRecommendations(
        state as string,
        district as string
      );
      res.json(recommendations);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async getMarketAnalysis(req: Request, res: Response) {
    const { commodity, state } = req.query;
    if (!commodity || !state) {
      return res.status(400).json({ error: 'commodity and state are required' });
    }

    try {
      const analysis = await recommendationService.getMarketAnalysis(
        commodity as string,
        state as string
      );
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
