import type { Response } from 'express';
import { z } from 'zod';
import { AdminService } from '../services/admin.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';

const adminService = new AdminService();

const districtParamsSchema = z.object({
  state: z.string().trim().min(1, 'State is required'),
  district: z.string().trim().min(1, 'District is required'),
});

/**
 * Both handlers assume they're mounted behind
 * `requireAuth, requireRole('ADMIN')` in the router — they don't re-check
 * the role themselves, matching how FarmController relies on requireAuth
 * having already run.
 */
export class AdminController {
  /** GET /admin/regions — country-wide, for the landing map. */
  async listRegions(req: AuthenticatedRequest, res: Response) {
    try {
      const regions = await adminService.listRegions();
      res.json(regions);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  /** GET /admin/regions/:state/:district — drill-down: farms + recommendations. */
  async getDistrict(req: AuthenticatedRequest, res: Response) {
    const parsed = districtParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid params' });
    }

    try {
      const result = await adminService.getDistrict(parsed.data.state, parsed.data.district);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
