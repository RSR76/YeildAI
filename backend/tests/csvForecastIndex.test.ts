import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import * as csvForecastIndex from '../src/lib/csvForecastIndex.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(here, 'fixtures/sample_lookup.csv');

beforeAll(() => {
  csvForecastIndex.__resetForTests(fixturePath);
});

describe('getLatestForecast', () => {
  it('returns the most recent row for a key', () => {
    const result = csvForecastIndex.getLatestForecast('Tomato', 'Uttar Pradesh', 'Barabanki', 'Barabanki');
    expect(result).not.toBeNull();
    expect(result?.date).toBe('2026-07-08');
    expect(result?.currentModalPrice).toBe(860);
    expect(result?.predictedPriceTrend).toBe('Rising');
  });

  it('is case- and whitespace-insensitive', () => {
    const result = csvForecastIndex.getLatestForecast('  tomato ', 'uttar pradesh', 'BARABANKI', ' barabanki');
    expect(result).not.toBeNull();
    expect(result?.commodity).toBe('Tomato');
  });

  it('returns null for no match', () => {
    const result = csvForecastIndex.getLatestForecast('Wheat', 'Punjab', 'Ludhiana', 'Ludhiana');
    expect(result).toBeNull();
  });

  it('returns the exact Forecast shape the frontend expects', () => {
    const result = csvForecastIndex.getLatestForecast('Onion', 'Maharashtra', 'Nashik', 'Lasalgaon');
    expect(result).toMatchObject({
      id: expect.any(String),
      commodity: 'Onion',
      state: 'Maharashtra',
      district: 'Nashik',
      market: 'Lasalgaon',
      date: expect.any(String),
      currentModalPrice: expect.any(Number),
      predictedPriceTrend: expect.any(String),
      confidence: expect.any(Number),
      confidenceBand: expect.any(String),
      priceTrendScore: expect.any(Number),
      probFalling: expect.any(Number),
      probRising: expect.any(Number),
      probStable: expect.any(Number),
    });
  });

  it('correctly parses a quoted market field containing an embedded comma', () => {
    const result = csvForecastIndex.getLatestForecast('Apple', 'Haryana', 'Karnal', 'New Grain Market (main), Karnal');
    expect(result).not.toBeNull();
    expect(result?.market).toBe('New Grain Market (main), Karnal');
  });
});

describe('getAllLatestForecasts', () => {
  it('returns one entry per unique commodity/state/district/market combination', () => {
    const all = csvForecastIndex.getAllLatestForecasts();
    expect(all).toHaveLength(3);
  });

  it('filters by commodity', () => {
    const onions = csvForecastIndex.getAllLatestForecasts('Onion');
    expect(onions).toHaveLength(1);
    expect(onions[0]?.market).toBe('Lasalgaon');
  });
});

describe('listAvailableCommodities', () => {
  it('returns a sorted list of unique commodities', () => {
    expect(csvForecastIndex.listAvailableCommodities()).toEqual(['Apple', 'Onion', 'Tomato']);
  });
});

describe('listAvailableMarkets', () => {
  it('filters markets by commodity', () => {
    const markets = csvForecastIndex.listAvailableMarkets('Tomato');
    expect(markets).toHaveLength(1);
    expect(markets[0]).toMatchObject({ commodity: 'Tomato', state: 'Uttar Pradesh', district: 'Barabanki', market: 'Barabanki' });
  });
});

describe('listAvailableLocations', () => {
  it('returns distinct state/district pairs across all commodities, sorted', () => {
    const locations = csvForecastIndex.listAvailableLocations();
    expect(locations).toEqual([
      { state: 'Haryana', district: 'Karnal' },
      { state: 'Maharashtra', district: 'Nashik' },
      { state: 'Uttar Pradesh', district: 'Barabanki' },
    ]);
  });
});

describe('getPriceHistory', () => {
  it('returns all rows for a key in ascending date order, read from disk on demand', () => {
    const history = csvForecastIndex.getPriceHistory('Tomato', 'Uttar Pradesh', 'Barabanki', 'Barabanki');
    expect(history).toHaveLength(2);
    expect(history.map((h) => h.date)).toEqual(['2026-07-01', '2026-07-08']);
    expect(history.map((h) => h.currentModalPrice)).toEqual([850, 860]);
  });

  it('returns an empty array for an unknown key', () => {
    expect(csvForecastIndex.getPriceHistory('Wheat', 'Punjab', 'Ludhiana', 'Ludhiana')).toEqual([]);
  });
});
