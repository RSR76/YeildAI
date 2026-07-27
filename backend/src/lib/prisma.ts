// Loaded here (not just in src/index.ts) so DATABASE_URL is populated before
// `new PrismaClient()` below runs no matter which module imports this file
// first — see src/index.ts for why import order matters for env loading.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient();
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;
