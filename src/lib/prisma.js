import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client Singleton
 * 
 * Ensures a single instance of PrismaClient is used throughout the application.
 * Prevents multiple connections during development with hot-reloading.
 */

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
