/**
 * Static reference data for Crop / Broker, used when running against the
 * local CSV-backed forecast provider instead of PostgreSQL. This mirrors
 * the seed data in prisma/seed.ts (that file is left untouched) so behavior
 * matches what `npm run prisma:seed` would produce against a real database.
 */

export interface StaticCrop {
  id: string;
  name: string;
  category: string | null;
  typicalYield: number | null;
  costOfCultivation: number | null;
  growthDuration: number | null;
  bestSeason: string | null;
}

export interface StaticBroker {
  id: string;
  name: string;
  location: string;
  contact: string;
  commodities: string[];
  rating: number;
  verified: boolean;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const CROP_SEED: Omit<StaticCrop, 'id'>[] = [
  { name: 'Tomato', category: 'Vegetable', typicalYield: 10, costOfCultivation: 15000, growthDuration: 90, bestSeason: 'Kharif' },
  { name: 'Onion', category: 'Vegetable', typicalYield: 12, costOfCultivation: 20000, growthDuration: 120, bestSeason: 'Rabi' },
  { name: 'Potato', category: 'Tuber', typicalYield: 15, costOfCultivation: 25000, growthDuration: 100, bestSeason: 'Rabi' },
  { name: 'Rice', category: 'Cereal', typicalYield: 20, costOfCultivation: 30000, growthDuration: 150, bestSeason: 'Kharif' },
  { name: 'Wheat', category: 'Cereal', typicalYield: 18, costOfCultivation: 28000, growthDuration: 120, bestSeason: 'Rabi' },
];

const BROKER_SEED: Omit<StaticBroker, 'id'>[] = [
  { name: 'AgriConnect Punjab', location: 'Ludhiana, Punjab', contact: '+91 9876543210', commodities: ['Wheat', 'Rice'], rating: 4.5, verified: true },
  { name: 'Krishi Mandi Hub', location: 'Nashik, Maharashtra', contact: '+91 8765432109', commodities: ['Onion', 'Tomato'], rating: 4.8, verified: true },
  { name: 'South Agro Traders', location: 'Kurnool, Andhra Pradesh', contact: '+91 7654321098', commodities: ['Chilli', 'Cotton'], rating: 4.2, verified: false },
  { name: 'Bihar Farmers Collective', location: 'Patna, Bihar', contact: '+91 6543210987', commodities: ['Potato', 'Maize'], rating: 4.0, verified: true },
];

export const STATIC_CROPS: StaticCrop[] = CROP_SEED.map((c) => ({ id: `crop-${slugify(c.name)}`, ...c }));
export const STATIC_BROKERS: StaticBroker[] = BROKER_SEED.map((b) => ({ id: `broker-${slugify(b.name)}`, ...b }));
