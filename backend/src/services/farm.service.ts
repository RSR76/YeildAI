import prisma from '../lib/prisma.js';

export interface CreateFarmInput {
  name: string;
  location: string;
  address?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  state: string;
  district: string;
  sizeAcres: number;
  soilType: string;
  crops: string[];
  irrigation: string;
}

export type UpdateFarmInput = { [K in keyof CreateFarmInput]?: CreateFarmInput[K] | undefined };

export class FarmNotFoundError extends Error {}

export class FarmService {
  async listForUser(userId: string) {
    return prisma.farmProfile.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async create(userId: string, input: CreateFarmInput) {
    const existingCount = await prisma.farmProfile.count({ where: { userId } });

    return prisma.farmProfile.create({
      data: {
        ...input,
        userId,
        // The user's very first farm becomes their default/active one.
        isDefault: existingCount === 0,
      },
    });
  }

  async update(userId: string, farmId: string, input: UpdateFarmInput) {
    const farm = await prisma.farmProfile.findFirst({ where: { id: farmId, userId } });
    if (!farm) {
      throw new FarmNotFoundError('Farm not found');
    }

    const data = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined)
    ) as Partial<CreateFarmInput>;

    return prisma.farmProfile.update({ where: { id: farmId }, data });
  }

  async delete(userId: string, farmId: string) {
    const farm = await prisma.farmProfile.findFirst({ where: { id: farmId, userId } });
    if (!farm) {
      throw new FarmNotFoundError('Farm not found');
    }

    await prisma.farmProfile.delete({ where: { id: farmId } });

    // If the deleted farm was the active one, promote another farm (if any)
    // so the user always has an active workspace.
    if (farm.isDefault) {
      const next = await prisma.farmProfile.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });
      if (next) {
        await prisma.farmProfile.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }
  }

  /** Marks `farmId` as the user's active/default farm (workspace switch). */
  async setActive(userId: string, farmId: string) {
    const farm = await prisma.farmProfile.findFirst({ where: { id: farmId, userId } });
    if (!farm) {
      throw new FarmNotFoundError('Farm not found');
    }

    await prisma.$transaction([
      prisma.farmProfile.updateMany({ where: { userId }, data: { isDefault: false } }),
      prisma.farmProfile.update({ where: { id: farmId }, data: { isDefault: true } }),
    ]);

    return prisma.farmProfile.findUnique({ where: { id: farmId } });
  }
}