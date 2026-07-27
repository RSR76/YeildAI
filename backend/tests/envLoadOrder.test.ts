import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Regression test for a real local-dev bug: src/index.ts used to write
 * `import app from './app.js'` before `import dotenv from 'dotenv'` /
 * `dotenv.config()`. ES module imports evaluate in the order they're
 * written, so app.js's transitive import of lib/prisma.ts constructed
 * `new PrismaClient()` before DATABASE_URL was loaded — every Prisma-backed
 * request (signup, login, farms) then failed with
 * `PrismaClientInitializationError: Environment variable not found:
 * DATABASE_URL`, while the CSV-backed forecast routes (no Prisma) kept
 * returning 200 the whole time, which is what made the bug easy to miss.
 *
 * This can't be caught by a plain unit test that just checks
 * `process.env.DATABASE_URL` after importing lib/prisma.ts in isolation:
 * `@prisma/client`'s own runtime does its own best-effort `.env` auto-load
 * as a side effect of being imported, which — depending on the host
 * process's cwd/module resolution — can mask the ordering bug in some
 * harnesses (e.g. under vitest) even though it reproduced reliably under
 * `tsx watch` (verified live via curl against the running dev server). The
 * one thing that reliably discriminates the broken code from the fix is the
 * literal import order in src/index.ts, so that's what this test checks.
 */
describe('src/index.ts import order', () => {
  it("loads dotenv/config before importing ./app.js, so DATABASE_URL is set before app.js's transitive Prisma client construction", () => {
    const source = readFileSync(path.resolve(here, '../src/index.ts'), 'utf-8');
    const importLines = source
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('import '));

    const dotenvIndex = importLines.findIndex((line) => /['"]dotenv\/config['"]/.test(line));
    const appIndex = importLines.findIndex((line) => /['"]\.\/app\.js['"]/.test(line));

    expect(dotenvIndex).toBeGreaterThanOrEqual(0);
    expect(appIndex).toBeGreaterThanOrEqual(0);
    expect(dotenvIndex).toBeLessThan(appIndex);
  });
});
