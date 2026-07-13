import prisma from '../lib/prisma.js';
export class BrokerController {
    async getAll(req, res) {
        try {
            const brokers = await prisma.broker.findMany();
            res.json(brokers);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async getById(req, res) {
        const { id } = req.params;
        try {
            const broker = await prisma.broker.findUnique({ where: { id: id } });
            if (!broker)
                return res.status(404).json({ error: 'Broker not found' });
            res.json(broker);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}
export class CropController {
    async getAll(req, res) {
        try {
            const crops = await prisma.crop.findMany();
            res.json(crops);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}
//# sourceMappingURL=misc.controller.js.map