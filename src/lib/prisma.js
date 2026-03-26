import { PrismaClient as PrismaPostgres } from '@prisma/client';
import { PrismaClient as PrismaLegacy } from '@prisma/legacy-client';

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma || new PrismaPostgres();

export const legacyPrisma =
  globalForPrisma.legacyPrisma || new PrismaLegacy();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.legacyPrisma = legacyPrisma;
}
