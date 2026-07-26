/**
 * Deterministic, per-farm derived data.
 *
 * There's no backend endpoint yet for soil testing or weather (see
 * lib/mockData.ts), so these generate illustrative data instead of a single
 * fixed dataset for every farm. Each farm's data is seeded from its own id
 * (and, for soil, its soil type) so:
 *   - switching farms actually changes what's shown
 *   - the same farm always shows the same numbers (stable across reloads)
 *   - values are broadly plausible for the stated soil type / region, not
 *     just random noise
 *
 * This is explicitly a stand-in — replace with real soil-lab and
 * weather-provider integrations when available, at which point this file
 * (and its two call sites) can be deleted.
 */

import type { FarmProfile } from './auth/types';
import type { SoilSample, WeatherDay, YieldPoint } from './types';
import {
  mockSoilSamples,
  mockWeatherWeek,
  mockYieldTrend,
} from './mockData';

/** Simple deterministic string hash -> 32-bit seed. */
function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Mulberry32 seeded PRNG — deterministic, fast, good enough for mock data. */
function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SOIL_TYPE_BASELINES: Record<string, { ph: number; n: number; p: number; k: number; organicCarbon: number; moisture: number }> = {
  'Alluvial loam': { ph: 6.6, n: 280, p: 20, k: 220, organicCarbon: 0.6, moisture: 22 },
  'Black cotton soil': { ph: 7.4, n: 260, p: 16, k: 340, organicCarbon: 0.55, moisture: 28 },
  'Red laterite': { ph: 5.6, n: 190, p: 12, k: 150, organicCarbon: 0.4, moisture: 16 },
  'Sandy loam': { ph: 6.2, n: 160, p: 15, k: 130, organicCarbon: 0.35, moisture: 12 },
  'Clay loam': { ph: 6.9, n: 300, p: 24, k: 260, organicCarbon: 0.68, moisture: 26 },
};

const IDEAL_RANGES: Record<string, { unit: string; idealMin: number; idealMax: number }> = {
  'Soil pH': { unit: 'pH', idealMin: 6.0, idealMax: 7.5 },
  'Nitrogen (N)': { unit: 'kg/ha', idealMin: 240, idealMax: 480 },
  'Phosphorus (P)': { unit: 'kg/ha', idealMin: 22, idealMax: 55 },
  'Potassium (K)': { unit: 'kg/ha', idealMin: 110, idealMax: 280 },
  'Organic Carbon': { unit: '%', idealMin: 0.5, idealMax: 1.0 },
  Moisture: { unit: '%', idealMin: 18, idealMax: 30 },
};

function statusFor(value: number, idealMin: number, idealMax: number): SoilSample['status'] {
  if (value < idealMin) return 'Low';
  if (value > idealMax) return 'High';
  return 'Optimal';
}

/** Generates plausible soil test results for a farm, seeded by its id + soil type. */
export function generateSoilSamples(farm: FarmProfile | null): SoilSample[] {
  if (!farm) return mockSoilSamples;

  const baseline = SOIL_TYPE_BASELINES[farm.soilType] ?? SOIL_TYPE_BASELINES['Alluvial loam'];
  const rng = mulberry32(hashString(farm.id));
  // +/- up to 12% jitter around the soil type's baseline, per parameter.
  const jitter = (value: number) => value * (1 + (rng() - 0.5) * 0.24);

  const values: Record<string, number> = {
    'Soil pH': Number(jitter(baseline.ph).toFixed(1)),
    'Nitrogen (N)': Math.round(jitter(baseline.n)),
    'Phosphorus (P)': Math.round(jitter(baseline.p)),
    'Potassium (K)': Math.round(jitter(baseline.k)),
    'Organic Carbon': Number(jitter(baseline.organicCarbon).toFixed(2)),
    Moisture: Math.round(jitter(baseline.moisture)),
  };

  return Object.entries(values).map(([parameter, value]) => {
    const range = IDEAL_RANGES[parameter];
    return {
      parameter,
      value,
      unit: range.unit,
      idealMin: range.idealMin,
      idealMax: range.idealMax,
      status: statusFor(value, range.idealMin, range.idealMax),
    };
  });
}

const CLIMATE_PROFILES = [
  { label: 'dry-hot', baseHigh: 35, baseLow: 24, baseRain: 15 },
  { label: 'humid-monsoon', baseHigh: 30, baseLow: 25, baseRain: 55 },
  { label: 'mild', baseHigh: 27, baseLow: 18, baseRain: 25 },
  { label: 'coastal', baseHigh: 31, baseLow: 25, baseRain: 40 },
] as const;

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function conditionFor(rainChance: number, rng: () => number): string {
  if (rainChance >= 70) return rng() > 0.5 ? 'Thunderstorms' : 'Rain';
  if (rainChance >= 45) return 'Rain';
  if (rainChance >= 25) return 'Cloudy';
  return rng() > 0.4 ? 'Sunny' : 'Partly Cloudy';
}

/** Generates a plausible 7-day forecast for a farm, seeded by its district + state. */
export function generateWeatherWeek(farm: FarmProfile | null): WeatherDay[] {
  if (!farm) return mockWeatherWeek;

  const seed = hashString(`${farm.district}|${farm.state}`);
  const rng = mulberry32(seed);
  const profile = CLIMATE_PROFILES[seed % CLIMATE_PROFILES.length];

  const startMonth = new Date().toLocaleDateString('en-IN', { month: 'short' });
  const startDay = new Date().getDate();

  return DAY_LABELS.map((day, i) => {
    const drift = Math.round((rng() - 0.5) * 6);
    const high = Math.round(profile.baseHigh + drift);
    const low = Math.round(profile.baseLow + drift * 0.6);
    const rainfallChance = Math.max(0, Math.min(95, Math.round(profile.baseRain + (rng() - 0.5) * 50)));

    return {
      day,
      date: `${startMonth} ${startDay + i}`,
      condition: conditionFor(rainfallChance, rng),
      high,
      low,
      rainfallChance,
    };
  });
}

// ...keep your existing soil/weather code above

/**
 * Generates illustrative yield history + prediction for a farm.
 *
 * Seeded from farm details so:
 * - switching farms changes the prediction
 * - the same farm remains stable across reloads
 * - farm size, soil type, crops and irrigation influence the result
 *
 * Replace with the real yield-model API when available.
 */
export function generateYieldTrend(farm: FarmProfile | null): YieldPoint[] {
  if (!farm) return mockYieldTrend;

  const seed = hashString(
    [
      farm.id,
      farm.state,
      farm.district,
      farm.soilType,
      farm.irrigation,
      [...farm.crops].sort().join('|'),
    ].join('|')
  );

  const rng = mulberry32(seed);

  const soilFactor: Record<string, number> = {
    'Alluvial loam': 1.08,
    'Black cotton soil': 1.05,
    'Red laterite': 0.92,
    'Sandy loam': 0.9,
    'Clay loam': 1.03,
  };

  const irrigationFactor: Record<string, number> = {
    'Drip Irrigation': 1.08,
    Drip: 1.08,
    Sprinkler: 1.04,
    Canal: 1.02,
    Borewell: 1.0,
    Rainfed: 0.9,
  };

  const soil = soilFactor[farm.soilType] ?? 1;
  const irrigation = irrigationFactor[farm.irrigation] ?? 1;

  // Farm-specific baseline yield.
  const baseYield =
    (34 + rng() * 8) *
    soil *
    irrigation;

  const seasons = [
    'Kharif 2024',
    'Rabi 2024',
    'Kharif 2025',
    'Rabi 2025',
    'Kharif 2026',
  ];

  const historical: YieldPoint[] = seasons.slice(0, 4).map((season, i) => {
    const trend = i * 1.2;
    const variation = (rng() - 0.5) * 5;

    return {
      season,
      actual: Number(
        Math.max(15, baseYield + trend + variation).toFixed(1)
      ),
      predicted: null,
    };
  });

  const latestActual = historical[historical.length - 1].actual ?? baseYield;

  // Small farm-specific expected improvement/decline.
  const expectedChange = -0.03 + rng() * 0.13;

  const nextYield = Number(
    Math.max(15, latestActual * (1 + expectedChange)).toFixed(1)
  );

  return [
    ...historical,
    {
      season: seasons[4],
      actual: null,
      predicted: nextYield,
    },
  ];
}

/**
 * Stable illustrative confidence score for the farm's yield prediction.
 */
export function generateYieldConfidence(farm: FarmProfile | null): number {
  if (!farm) return 88;

  const seed = hashString(
    `${farm.id}|${farm.soilType}|${farm.irrigation}|yield-confidence`
  );

  const rng = mulberry32(seed);

  return Math.round(78 + rng() * 17);
}