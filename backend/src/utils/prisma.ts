import { PrismaClient } from '@prisma/client';
import { config, isDevelopment } from '@config';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: isDevelopment ? ['query', 'error', 'warn'] : ['error'],
});

if (isDevelopment) globalForPrisma.prisma = prisma;

export default prisma;