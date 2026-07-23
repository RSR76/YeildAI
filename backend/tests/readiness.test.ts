import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import * as csvForecastIndex from '../src/lib/csvForecastIndex.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(here, 'fixtures/sample_lookup.csv');

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(() => {
  server.close();
});

// Every test starts from a known, neutral (not-ready) state.
beforeEach(() => {
  csvForecastIndex.__setReadinessForTests({ status: 'initializing', startedAt: Date.now() });
});

describe('GET /health', () => {
  it('returns 200 ok regardless of forecast index readiness', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});

describe('GET /ready', () => {
  it('returns 503 while initializing', async () => {
    const res = await fetch(`${baseUrl}/ready`);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'initializing' });
  });

  it('returns 503 with a safe error message when initialization failed', async () => {
    csvForecastIndex.__setReadinessForTests({
      status: 'failed',
      startedAt: Date.now(),
      error: 'ENOENT: /very/internal/path/should/not/leak/to/clients.csv',
    });
    const res = await fetch(`${baseUrl}/ready`);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe('failed');
    expect(body.error).toBe('Forecast index failed to initialize');
    expect(body.error).not.toContain('/very/internal/path');
  });

  it('returns 200 with useful status details once the index is ready', async () => {
    csvForecastIndex.__resetForTests(fixturePath);
    csvForecastIndex.__markReadyForTests();
    const res = await fetch(`${baseUrl}/ready`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ready');
    expect(body.commodityCount).toBe(3);
    expect(body.locationCount).toBeGreaterThan(0);
    expect(typeof body.initializedInMs).toBe('number');
  });
});

describe('forecast and recommendation endpoints while not ready', () => {
  it('returns a consistent 503 payload for forecast endpoints before the index is ready', async () => {
    const res = await fetch(`${baseUrl}/api/forecast/all-latest`);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'Backend is initializing', retryable: true });
  });

  it('returns the same 503 payload for recommendation endpoints before the index is ready', async () => {
    const res = await fetch(`${baseUrl}/api/recommendations?state=Uttar%20Pradesh&district=Barabanki`);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'Backend is initializing', retryable: true });
  });

  it('returns 503 even if initialization has failed', async () => {
    csvForecastIndex.__setReadinessForTests({ status: 'failed', startedAt: Date.now(), error: 'boom' });
    const res = await fetch(`${baseUrl}/api/forecast/commodities`);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'Backend is initializing', retryable: true });
  });

  it('processes forecast requests normally once ready, with the existing response shape', async () => {
    csvForecastIndex.__resetForTests(fixturePath);
    csvForecastIndex.__markReadyForTests();
    const res = await fetch(`${baseUrl}/api/forecast/all-latest`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toMatchObject({ commodity: expect.any(String), currentModalPrice: expect.any(Number) });
  });

  it('does not accept static-data routes being confused for gated ones (brokers stays ungated)', async () => {
    const res = await fetch(`${baseUrl}/api/brokers`);
    expect(res.status).toBe(200);
  });
});
