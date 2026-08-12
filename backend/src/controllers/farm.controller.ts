import type { Response } from 'express';
import { z } from 'zod';
import { FarmService, FarmNotFoundError } from '../services/farm.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';

const farmService = new FarmService();

const createFarmSchema = z.object({
  name: z.string().trim().min(1, 'Farm name is required'),
  location: z.string().trim().min(1, 'Location is required'),
  address: z.string().trim().min(1).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  state: z.string().trim().min(1, 'State is required'),
  district: z.string().trim().min(1, 'District is required'),
  sizeAcres: z.number().positive('Size must be greater than 0'),
  soilType: z.string().trim().min(1, 'Soil type is required'),
  crops: z.array(z.string().trim().min(1)).default([]),
  irrigation: z.string().trim().min(1, 'Irrigation type is required'),
});

const updateFarmSchema = createFarmSchema.partial();

export class FarmController {
  async list(req: AuthenticatedRequest, res: Response) {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const farms = await farmService.listForUser(req.userId);
      res.json(farms);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async create(req: AuthenticatedRequest, res: Response) {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

    const parsed = createFarmSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    }

    try {
      const farm = await farmService.create(req.userId, parsed.data);
      res.status(201).json(farm);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async update(req: AuthenticatedRequest, res: Response) {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

    const farmId = req.params.id;
    if (typeof farmId !== 'string') {
      return res.status(400).json({ error: 'Invalid farm id' });
    }

    const parsed = updateFarmSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    }

    try {
      const farm = await farmService.update(req.userId, farmId, parsed.data);
      res.json(farm);
    } catch (error) {
      if (error instanceof FarmNotFoundError) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async remove(req: AuthenticatedRequest, res: Response) {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

    const farmId = req.params.id;
    if (typeof farmId !== 'string') {
      return res.status(400).json({ error: 'Invalid farm id' });
    }

    try {
      await farmService.delete(req.userId, farmId);
      res.status(204).send();
    } catch (error) {
      if (error instanceof FarmNotFoundError) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async setActive(req: AuthenticatedRequest, res: Response) {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

    const farmId = req.params.id;
    if (typeof farmId !== 'string') {
      return res.status(400).json({ error: 'Invalid farm id' });
    }

    try {
      const farm = await farmService.setActive(req.userId, farmId);
      res.json(farm);
    } catch (error) {
      if (error instanceof FarmNotFoundError) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: (error as Error).message });
    }
  }
}