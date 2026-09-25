import type { FastifyInstance } from 'fastify';
import { dashboardSummary } from '../data/dashboard.js';

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/dashboard', async () => ({
    ok: true,
    data: dashboardSummary,
  }));
}
