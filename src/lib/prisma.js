import { PrismaClient as PrismaPostgres } from '@prisma/client';

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma || new PrismaPostgres();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
