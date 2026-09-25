import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient | null {
  if (prisma) return prisma;
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Phase 1B: DB optional — fallback to in-memory store when no DATABASE_URL
    return null;
  }
  prisma = new PrismaClient();
  return prisma;
}

// Helper to check DB availability without throwing in routes
export function isDbEnabled(): boolean {
  return !!process.env.DATABASE_URL;
}
