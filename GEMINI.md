# YeildAI Project Documentation

## Overview
YeildAI is a project focused on forecasting commodity data with modular ML integration.

## Tech Stack
- **Backend:** Express, Prisma, PostgreSQL
- **Frontend:** Next.js, TypeScript, Tailwind, Recharts, Lucide

## Folder Structure
- `backend/`: Express API with Prisma/PostgreSQL.
- `frontend/`: Next.js web application.
- `get_forecast_multi_commodity.py`: Data ingestion/processing script.

## Development Rules
- **No Authentication:** Not required for this phase.
- **Modularity:** Keep recommendation and prediction logic modular for future ML integration.
- **Reuse:** Always reuse existing architecture.
- **Inspection:** Always inspect existing code before modifying it.
- **Incremental:** Build one module at a time.
- **File Management:** Do not recreate existing files. Do not reread README unless specifically requested.

## Coding Conventions
- Adhere to idiomatic TypeScript practices.
- Follow established project folder structure.
