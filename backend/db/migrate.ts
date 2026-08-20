/**
 * Minimal migration runner for backend/db/migrations/*.sql. Applies files in
 * filename order, tracks what's already applied in a `schema_migrations`
 * table, and wraps each file in its own transaction so a failure partway
 * through one file rolls that file back cleanly (already-applied files
 * before it stay applied — migrations are meant to be run in order and are
 * additive, so this is the right unit of atomicity, not "all files or none").
 *
 * Deliberately not a general-purpose migration framework (no down-migrations,
 * no checksum verification) — this project needs "apply the schema to a
 * fresh dev/staging database reproducibly", not a multi-team migration
 * history tool. See docs/POSTGRES_FORECAST_MIGRATION_PLAN.md for the
 * broader rollout plan.
 *
 * Usage:
 *   npm run db:migrate            # apply all pending migrations
 *   npm run db:migrate:dry-run    # list pending migrations, apply nothing
 */
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, 'migrations');

async function listMigrationFiles(): Promise<string[]> {
  const entries = await fs.readdir(migrationsDir);
  return entries.filter((f) => f.endsWith('.sql')).sort();
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const files = await listMigrationFiles();

  if (dryRun && !process.env.DATABASE_URL) {
    // No DB required for a dry run — just report what would be applied,
    // in order, so this is usable even without a live Postgres instance.
    console.log('[migrate] --dry-run (no DATABASE_URL set): migrations that would be applied, in order:');
    for (const file of files) console.log(`  - ${file}`);
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[migrate] DATABASE_URL is not set. Set it in backend/.env (see backend/.env.example) or run with --dry-run.');
    process.exitCode = 1;
    return;
  }

  // Mirrors backend/src/lib/pgPool.ts's SSL detection — managed providers
  // (Render, RDS, etc.) require SSL; a local/Docker Postgres doesn't have a
  // TLS listener at all, so this is hostname-detected rather than assumed.
  const isLocalHost = /localhost|127\.0\.0\.1/.test(connectionString);
  const sslRequired = process.env.PGSSLMODE === 'require' || !isLocalHost;
  const pool = new Pool({ connectionString, ssl: sslRequired ? { rejectUnauthorized: false } : undefined });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await pool.query<{ filename: string }>('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));
    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log('[migrate] No pending migrations — schema is up to date.');
      return;
    }

    if (dryRun) {
      console.log('[migrate] --dry-run: pending migrations that would be applied, in order:');
      for (const file of pending) console.log(`  - ${file}`);
      return;
    }

    for (const file of pending) {
      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[migrate] applied ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrate] FAILED applying ${file}:`, err instanceof Error ? err.message : err);
        process.exitCode = 1;
        return;
      } finally {
        client.release();
      }
    }

    console.log(`[migrate] done — applied ${pending.length} migration(s).`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[migrate] unexpected error:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
