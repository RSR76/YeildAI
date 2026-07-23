import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { ForecastController } from './controllers/forecast.controller.js';
import { RecommendationController } from './controllers/recommendation.controller.js';
import { BrokerController, CropController } from './controllers/misc.controller.js';
import { getReadinessState } from './lib/csvForecastIndex.js';

const app = express();

app.use(cors());
app.use(express.json());

const forecastController = new ForecastController();
const recommendationController = new RecommendationController();
const brokerController = new BrokerController();
const cropController = new CropController();

/**
 * Gates forecast/recommendation routes on the forecast index readiness
 * state, checked fresh on every request (not just at startup) so traffic
 * never reaches these handlers before initializeForecastIndex() has
 * finished successfully — even if it fails and never recovers.
 */
function requireForecastIndexReady(req: Request, res: Response, next: NextFunction) {
  if (getReadinessState().status === 'ready') return next();
  res.status(503).json({ error: 'Backend is initializing', retryable: true });
}

// Forecast Routes
app.get('/api/forecast/latest', requireForecastIndexReady, forecastController.getLatest);
app.get('/api/forecast/all-latest', requireForecastIndexReady, forecastController.getAllLatest);
app.get('/api/forecast/commodities', requireForecastIndexReady, forecastController.getCommodities);
app.get('/api/forecast/markets', requireForecastIndexReady, forecastController.getMarkets);
app.get('/api/forecast/locations', requireForecastIndexReady, forecastController.getLocations);
app.get('/api/forecast/history', requireForecastIndexReady, forecastController.getHistory);

// Recommendation Routes
app.get('/api/recommendations', requireForecastIndexReady, recommendationController.getRecommendations);
app.get('/api/analysis', requireForecastIndexReady, recommendationController.getMarketAnalysis);

// Misc Routes (static data, independent of the forecast index)
app.get('/api/brokers', brokerController.getAll);
app.get('/api/brokers/:id', brokerController.getById);
app.get('/api/crops', cropController.getAll);

// Health Check — lightweight process liveness only. Does not reflect
// forecast index readiness; use GET /ready for that.
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Readiness Check — reflects forecast index initialization state.
app.get('/ready', (req, res) => {
  const state = getReadinessState();
  if (state.status === 'ready') {
    return res.status(200).json({
      status: 'ready',
      commodityCount: state.commodityCount,
      locationCount: state.locationCount,
      initializedInMs: state.readyAt - state.startedAt,
    });
  }
  if (state.status === 'failed') {
    return res.status(503).json({ status: 'failed', error: 'Forecast index failed to initialize' });
  }
  return res.status(503).json({ status: 'initializing' });
});

export default app;
