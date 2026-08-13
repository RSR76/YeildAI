import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';

import { ForecastController } from './controllers/forecast.controller.js';
import { RecommendationController } from './controllers/recommendation.controller.js';
import {
  BrokerController,
  CropController,
} from './controllers/misc.controller.js';
import { GeocodeController } from './controllers/geocode.controller.js';
import { AuthController } from './controllers/auth.controller.js';
import { FarmController } from './controllers/farm.controller.js';

import { requireAuth } from './middleware/auth.middleware.js';

import { getReadinessState } from './lib/csvForecastIndex.js';

import adminRoutes from './routes/admin.routes.js';

const app = express();

app.use(cors());
app.use(express.json());

const forecastController = new ForecastController();
const recommendationController = new RecommendationController();
const brokerController = new BrokerController();
const cropController = new CropController();
const geocodeController = new GeocodeController();
const authController = new AuthController();
const farmController = new FarmController();

function requireForecastIndexReady(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (getReadinessState().status === 'ready') {
    return next();
  }

  res.status(503).json({
    error: 'Backend is initializing',
    retryable: true,
  });
}

// ─────────────────────────────────────────────
// Auth Routes
// ─────────────────────────────────────────────

app.post('/api/auth/signup', authController.signup);
app.post('/api/auth/login', authController.login);
app.get('/api/auth/me', requireAuth, authController.me);

// ─────────────────────────────────────────────
// Farm Profile Routes
// ─────────────────────────────────────────────

app.get('/api/farms', requireAuth, farmController.list);
app.post('/api/farms', requireAuth, farmController.create);
app.patch('/api/farms/:id', requireAuth, farmController.update);
app.delete('/api/farms/:id', requireAuth, farmController.remove);
app.post('/api/farms/:id/activate', requireAuth, farmController.setActive);

// ─────────────────────────────────────────────
// Admin Routes
// ─────────────────────────────────────────────

app.use('/api/admin', adminRoutes);

// ─────────────────────────────────────────────
// Forecast Routes
// ─────────────────────────────────────────────

app.get(
  '/api/forecast/latest',
  requireForecastIndexReady,
  forecastController.getLatest
);

app.get(
  '/api/forecast/all-latest',
  requireForecastIndexReady,
  forecastController.getAllLatest
);

app.get(
  '/api/forecast/commodities',
  requireForecastIndexReady,
  forecastController.getCommodities
);

app.get(
  '/api/forecast/markets',
  requireForecastIndexReady,
  forecastController.getMarkets
);

app.get(
  '/api/forecast/locations',
  requireForecastIndexReady,
  forecastController.getLocations
);

app.get(
  '/api/forecast/history',
  requireForecastIndexReady,
  forecastController.getHistory
);

// ─────────────────────────────────────────────
// Recommendation Routes
// ─────────────────────────────────────────────

app.get(
  '/api/recommendations',
  requireForecastIndexReady,
  recommendationController.getRecommendations
);

app.get(
  '/api/analysis',
  requireForecastIndexReady,
  recommendationController.getMarketAnalysis
);

// ─────────────────────────────────────────────
// Geocode Routes
// ─────────────────────────────────────────────

app.get(
  '/api/geocode/reverse',
  requireForecastIndexReady,
  geocodeController.reverseGeocode
);

// ─────────────────────────────────────────────
// Misc Routes
// ─────────────────────────────────────────────

app.get('/api/brokers', brokerController.getAll);
app.get('/api/brokers/:id', brokerController.getById);
app.get('/api/crops', cropController.getAll);

// ─────────────────────────────────────────────
// Health / Readiness
// ─────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

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
    return res.status(503).json({
      status: 'failed',
      error: 'Forecast index failed to initialize',
    });
  }

  return res.status(503).json({
    status: 'initializing',
  });
});

export default app;