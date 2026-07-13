import { RecommendationService } from '../services/recommendation.service.js';
const recommendationService = new RecommendationService();
export class RecommendationController {
    async getRecommendations(req, res) {
        const { state, district } = req.query;
        if (!state || !district) {
            return res.status(400).json({ error: 'state and district are required' });
        }
        try {
            const recommendations = await recommendationService.getRecommendations(state, district);
            res.json(recommendations);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async getMarketAnalysis(req, res) {
        const { commodity, state } = req.query;
        if (!commodity || !state) {
            return res.status(400).json({ error: 'commodity and state are required' });
        }
        try {
            const analysis = await recommendationService.getMarketAnalysis(commodity, state);
            res.json(analysis);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}
//# sourceMappingURL=recommendation.controller.js.map