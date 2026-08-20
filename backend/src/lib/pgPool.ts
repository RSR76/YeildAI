/**
 * Singleton pg.Pool for the analytical schema (states/districts/markets/
 * commodities/market_prices/model_runs/price_forecasts — see backend/db/migrations/).
 * Deliberately separate from lib/prisma.ts: Prisma owns User/FarmProfile and
 * the legacy unused Forecast/Crop/etc. models; this pool owns the raw-SQL,
 * partitioned analytical tables that Prisma's declarative migrations can't
 * express well (see docs/POSTGRES_FORECAST_MIGRATION_PLAN.md for why).
 *
 * DATABASE_URL is intentionally never logged here or anywhere else in this
 * module — only connection outcome (ok/error) is logged.
 */

import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Required when FORECAST_DATA_SOURCE=postgres.');
  }

  // Managed providers (Render, RDS, etc.) require SSL and terminate
  // non-SSL connections with "SSL/TLS required" — detected by hostname
  // rather than assumed, so a plain local/Docker Postgres (no TLS listener)
  // keeps working unchanged. rejectUnauthorized: false matches Render's own
  // documented Node/pg connection guidance (their cert chain isn't in
  // Node's default trust store); this is standard practice for managed
  // Postgres, not a relaxation of an otherwise-verifiable chain.
  const isLocalHost = /localhost|127\.0\.0\.1/.test(connectionString);
  const sslRequired = process.env.PGSSLMODE === 'require' || !isLocalHost;

  pool = new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: sslRequired ? { rejectUnauthorized: false } : undefined,
  });

  pool.on('error', (err) => {
    // Fires for errors on idle clients (e.g. connection dropped by the
    // server) — must be handled or an unhandled error crashes the process.
    console.error('[pgPool] idle client error:', err.message);
  });

  return pool;
}

/** Verifies the pool can actually reach Postgres. Used by the readiness/startup check — never swallowed into a silent fallback. */
export async function checkPoolConnection(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

/** Test-only / graceful-shutdown hook. */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
