import type { FastifyInstance } from 'fastify';

import { getPrisma } from '../config/db.js';
import { isS3Enabled } from '../services/storage.js';
import { isQueueEnabled } from '../queue/queue.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    const checks: any = { api: 'ok' };
    // DB check
    try {
      const prisma = getPrisma();
      if (prisma && process.env.DATABASE_URL) {
        await prisma.$queryRaw`SELECT 1`;
        checks.db = 'ok';
      } else checks.db = 'disabled (no DATABASE_URL)';
    } catch (e: any) { checks.db = `error: ${e.message}`; }
    // Redis check
    checks.queue = isQueueEnabled() ? 'ok (Upstash)' : 'inline (no REDIS_URL)';
    // S3 check
    checks.storage = isS3Enabled() ? 'ok (Supabase S3)' : 'local fallback';
    return { ok: checks.db?.startsWith('ok'), service: 'careerpilot-api', timestamp: new Date().toISOString(), checks, version: '0.1.0-phase11' };
  });

  app.get('/health/detailed', async () => {
    const prisma = getPrisma();
    let counts: any = {};
    if (prisma && process.env.DATABASE_URL) {
      try {
        const [jobs, apps, notifs] = await Promise.all([
          prisma.job.count(), prisma.application.count(), prisma.notification.count()
        ]);
        counts = { jobs, applications: apps, notifications: notifs };
      } catch {}
    }
    return { counts, env: { hasDb: !!process.env.DATABASE_URL, hasRedis: !!process.env.REDIS_URL, hasS3: isS3Enabled() } };
  });
}
