import type { Request, Response } from 'express';
import { STATIC_BROKERS, STATIC_CROPS } from '../lib/staticData.js';

export class BrokerController {
  async getAll(req: Request, res: Response) {
    res.json(STATIC_BROKERS);
  }

  async getById(req: Request, res: Response) {
    const { id } = req.params;
    const broker = STATIC_BROKERS.find((b) => b.id === id);
    if (!broker) return res.status(404).json({ error: 'Broker not found' });
    res.json(broker);
  }
}

export class CropController {
  async getAll(req: Request, res: Response) {
    res.json(STATIC_CROPS);
  }
}
