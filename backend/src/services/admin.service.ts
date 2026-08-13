import prisma from '../lib/prisma.js';
import { RecommendationService } from './recommendation.service.js';

const recommendationService = new RecommendationService();

export interface RegionSummary {
  state: string;
  district: string;
  farmCount: number;
  totalAcres: number;
  /** Centroid of the farms that have coordinates, for the country map. */
  latitude: number | null;
  longitude: number | null;
  topCrops: string[];
}

/**
 * Powers the Admin persona's "all farms in an area/district" view.
 *
 * Deliberately reuses FarmProfile (the same model farmers write to) rather
 * than a separate admin-only table — an admin should see the real farms
 * farmers registered, not a parallel dataset that can drift out of sync.
 */
export class AdminService {
  /**
   * Country-wide, one row per (state, district) that has at least one farm.
   * This is what renders as pins/regions on the admin's landing map before
   * they drill into a specific district.
   */
  async listRegions(): Promise<RegionSummary[]> {
    const farms = await prisma.farmProfile.findMany({
      select: {
        state: true,
        district: true,
        sizeAcres: true,
        crops: true,
        latitude: true,
        longitude: true,
      },
    });

    const byRegion = new Map<
      string,
      { state: string; district: string; farms: typeof farms }
    >();

    for (const farm of farms) {
      const key = `${farm.state.toLowerCase()}::${farm.district.toLowerCase()}`;
      const bucket = byRegion.get(key);
      if (bucket) {
        bucket.farms.push(farm);
      } else {
        byRegion.set(key, { state: farm.state, district: farm.district, farms: [farm] });
      }
    }

    const regions: RegionSummary[] = [];
    for (const { state, district, farms: regionFarms } of byRegion.values()) {
      const withCoords = regionFarms.filter(
        (f): f is typeof f & { latitude: number; longitude: number } =>
          f.latitude !== null && f.longitude !== null
      );

      const latitude = withCoords.length
        ? withCoords.reduce((sum, f) => sum + f.latitude, 0) / withCoords.length
        : null;
      const longitude = withCoords.length
        ? withCoords.reduce((sum, f) => sum + f.longitude, 0) / withCoords.length
        : null;

      const cropCounts = new Map<string, number>();
      for (const f of regionFarms) {
        for (const crop of f.crops) {
          cropCounts.set(crop, (cropCounts.get(crop) ?? 0) + 1);
        }
      }
      const topCrops = [...cropCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([crop]) => crop);

      regions.push({
        state,
        district,
        farmCount: regionFarms.length,
        totalAcres: Math.round(regionFarms.reduce((sum, f) => sum + f.sizeAcres, 0) * 100) / 100,
        latitude,
        longitude,
        topCrops,
      });
    }

    return regions.sort((a, b) => b.farmCount - a.farmCount);
  }

  /**
   * Drill-down for a single district: every registered farm in it, plus the
   * same recommendation + reasoning payload a farmer in that district would
   * see (RecommendationService.getRecommendations), so the admin's
   * "recommendations for this area" and mapping view are backed by the
   * exact same scoring/reasoning logic — not a second, divergent model.
   */
  async getDistrict(state: string, district: string) {
    const farms = await prisma.farmProfile.findMany({
      where: {
        state: { equals: state, mode: 'insensitive' },
        district: { equals: district, mode: 'insensitive' },
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const recommendations = await recommendationService.getRecommendations(state, district);

    return { state, district, farms, recommendations };
  }
}
