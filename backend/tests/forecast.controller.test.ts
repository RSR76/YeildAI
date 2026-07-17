import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as csvForecastIndex from '../src/lib/csvForecastIndex.js';
import { ForecastController } from '../src/controllers/forecast.controller.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(here, 'fixtures/sample_lookup.csv');

beforeAll(() => {
  csvForecastIndex.__resetForTests(fixturePath);
});

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('ForecastController.getLatest', () => {
  const controller = new ForecastController();

  it('400s when required query params are missing', async () => {
    const req: any = { query: { commodity: 'Tomato' } };
    const res = mockRes();
    await controller.getLatest(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Invalid query parameters', details: expect.any(Array) })
    );
  });

  it('404s with no forecast found for an unknown combination', async () => {
    const req: any = { query: { commodity: 'Wheat', state: 'Punjab', district: 'Ludhiana', market: 'Ludhiana' } };
    const res = mockRes();
    await controller.getLatest(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('200s with the forecast for a known combination', async () => {
    const req: any = { query: { commodity: 'Tomato', state: 'Uttar Pradesh', district: 'Barabanki', market: 'Barabanki' } };
    const res = mockRes();
    await controller.getLatest(req, res);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ commodity: 'Tomato', predictedPriceTrend: 'Rising' }));
  });
});

describe('ForecastController.getLocations', () => {
  const controller = new ForecastController();

  it('200s with distinct state/district pairs, no params required', async () => {
    const req: any = { query: {} };
    const res = mockRes();
    await controller.getLocations(req, res);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ state: 'Uttar Pradesh', district: 'Barabanki' })])
    );
  });
});

describe('ForecastController.getHistory', () => {
  const controller = new ForecastController();

  it('400s when required query params are missing', async () => {
    const req: any = { query: {} };
    const res = mockRes();
    await controller.getHistory(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('200s with an array of history rows', async () => {
    const req: any = { query: { commodity: 'Tomato', state: 'Uttar Pradesh', district: 'Barabanki', market: 'Barabanki' } };
    const res = mockRes();
    await controller.getHistory(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ date: '2026-07-01' }), expect.objectContaining({ date: '2026-07-08' })])
    );
  });
});
