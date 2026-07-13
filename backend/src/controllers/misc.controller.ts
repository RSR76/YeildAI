import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';

export class BrokerController {
  async getAll(req: Request, res: Response) {
    try {
      const brokers = await prisma.broker.findMany();
      res.json(brokers);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async getById(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const broker = await prisma.broker.findUnique({ where: { id: id as string } });
      if (!broker) return res.status(404).json({ error: 'Broker not found' });
      res.json(broker);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}

export class CropController {
  async getAll(req: Request, res: Response) {
    try {
      const crops = await prisma.crop.findMany();
      res.json(crops);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
