import type { NextFunction, Request, Response } from 'express';
import { getRepositoryReadinessState } from '../repositories/forecastRepositoryFactory.js';

/**
 * Gates any route that depends on the forecast repository (CSV or Postgres)
 * being ready. Extracted to its own module (rather than living only in
 * app.ts, as it originally did) so admin routes — which call into
 * RecommendationService/ForecastService just like the public forecast
 * routes — can be gated by it too without an app.ts <-> admin.routes.ts
 * circular import.
 *
 * Same generic, non-leaky payload for both 'initializing' and 'failed' — a
 * 'failed' state (e.g. FORECAST_DATA_SOURCE=postgres with an unreachable
 * database) still surfaces as a real 503 rather than a silent fallback to
 * stale CSV data, but the detailed reason belongs on the operator-facing
 * GET /ready endpoint, not on every gated route's response body (which
 * could otherwise leak DB error internals to API clients).
 */
export function requireForecastRepositoryReady(req: Request, res: Response, next: NextFunction) {
  if (getRepositoryReadinessState().status === 'ready') {
    return next();
  }

  res.status(503).json({
    error: 'Backend is initializing',
    retryable: true,
  });
}
