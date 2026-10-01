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
import { requireForecastRepositoryReady } from './middleware/forecastReadiness.middleware.js';

import { getRepositoryReadinessState } from './repositories/forecastRepositoryFactory.js';

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

// Admin regions/district endpoints call into RecommendationService just like
// the public forecast routes below, so they need the same readiness gate —
// otherwise a request during startup/DB-outage surfaces as an opaque 500
// with a raw "repository not initialized" error instead of a clean 503.
app.use('/api/admin', requireForecastRepositoryReady, adminRoutes);

// ─────────────────────────────────────────────
// Forecast Routes
// ─────────────────────────────────────────────

app.get(
  '/api/forecast/latest',
  requireForecastRepositoryReady,
  forecastController.getLatest
);

app.get(
  '/api/forecast/all-latest',
  requireForecastRepositoryReady,
  forecastController.getAllLatest
);

app.get(
  '/api/forecast/commodities',
  requireForecastRepositoryReady,
  forecastController.getCommodities
);

app.get(
  '/api/forecast/markets',
  requireForecastRepositoryReady,
  forecastController.getMarkets
);

app.get(
  '/api/forecast/locations',
  requireForecastRepositoryReady,
  forecastController.getLocations
);

app.get(
  '/api/forecast/history',
  requireForecastRepositoryReady,
  forecastController.getHistory
);

// Year-aware endpoints (genuine multi-year history) — see
// docs/POSTGRES_FORECAST_MIGRATION_PLAN.md and forecastRepository.ts.
app.get(
  '/api/forecast/years',
  requireForecastRepositoryReady,
  forecastController.getYears
);

app.get(
  '/api/forecast/yearly-history',
  requireForecastRepositoryReady,
  forecastController.getYearlyHistory
);

app.get(
  '/api/forecast/year-comparison',
  requireForecastRepositoryReady,
  forecastController.getYearComparison
);

// ─────────────────────────────────────────────
// Recommendation Routes
// ─────────────────────────────────────────────

app.get(
  '/api/recommendations',
  requireForecastRepositoryReady,
  recommendationController.getRecommendations
);

app.get(
  '/api/analysis',
  requireForecastRepositoryReady,
  recommendationController.getMarketAnalysis
);

// ─────────────────────────────────────────────
// Geocode Routes
// ─────────────────────────────────────────────

app.get(
  '/api/geocode/reverse',
  requireForecastRepositoryReady,
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
  const state = getRepositoryReadinessState();

  if (state.status === 'ready') {
    return res.status(200).json({
      status: 'ready',
      dataSource: state.source,
      initializedInMs: state.readyAt - state.startedAt,
    });
  }

  if (state.status === 'failed') {
    // /ready is unauthenticated and public — the detailed error (which can
    // contain internal hostnames/ports/connection details for the Postgres
    // path) is already logged server-side by
    // forecastRepositoryFactory.initializeForecastRepository(); it must not
    // also be echoed back in a response any caller on the internet can read.
    return res.status(503).json({
      status: 'failed',
      dataSource: state.source,
      error: `Forecast data source (${state.source}) failed to initialize. See server logs for details.`,
    });
  }

  return res.status(503).json({
    status: 'initializing',
    dataSource: state.source,
  });
});

export default app;