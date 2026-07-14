# HANDOFF.md

## Project Status
The backend API is implemented (Forecast, Recommendation, and Misc/Broker/Crop modules).
The frontend now has all MVP pages implemented and wired to a data-service layer
(`frontend/lib/dataService.ts`) that calls the real backend and transparently
falls back to a typed mock data layer (`frontend/lib/mockData.ts`) when the
backend/CSV/database is unavailable. `npm run build`, `tsc --noEmit`, and
`eslint` all pass cleanly.

## Completed Backend Modules
- **Forecast Module:** Fully implemented and verified.
- **Recommendation Module:** Fully implemented and verified.
- **Misc Entities Module:** Fully implemented and verified.
- **Database Schema:** Fully defined and migration-ready.

## Pending Backend Modules
- No dedicated endpoint yet for: Reports, Farm Profile, Soil Analysis, Yield Prediction, Weather.
  These currently read from the frontend mock data layer only.

## Frontend Status
- `/dashboard` — complete (pre-existing), uses inline mock data.
- `/recommendations` — wired to `getRecommendations()` (real `/api/recommendations` with mock fallback).
- `/mandi-prices` — wired to `getAllLatestForecasts()` / `getForecastHistory()` (real `/api/forecast/*` with mock fallback).
- `/farm-details`, `/soil-analysis`, `/yield-prediction`, `/weather`, `/reports` — implemented against the mock data layer (`lib/mockData.ts`), since no backend endpoints exist for these yet.
- Sidebar/Navbar now link to and title all real routes (previously linked to non-existent `/forecasts`, `/brokers`, `/settings`).

## Pages Using Mock Data (fully or as fallback)
- Farm Details (mock only — no backend model wired yet)
- Soil Analysis (mock only — no backend model wired yet)
- Yield Prediction (mock only — no backend model yet)
- Reports (mock only — no backend model yet)
- Weather (mock only — no backend model yet)
- Mandi Prices (real API with mock fallback)
- Recommendations (real API with mock fallback)

## Next Recommended Task
- Add backend endpoints for Reports, Farm Profile, Soil Analysis, Yield
  Prediction, and Weather so `frontend/lib/dataService.ts` can be pointed at
  them (mirroring the pattern already used for forecasts/recommendations),
  then remove the corresponding mock fallbacks in `frontend/lib/mockData.ts`.