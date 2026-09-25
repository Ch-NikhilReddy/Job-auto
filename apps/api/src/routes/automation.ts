import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDiscoveryQueue, isQueueEnabled } from '../queue/queue.js';
import { runDiscoveryOnce, startDiscoveryWorker } from '../workers/discoveryWorker.js';
import { getPrisma } from '../config/db.js';
import { notify } from '../services/notification.js';

// In-memory scheduler state (Phase 2: inline cron when REDIS absent, BullMQ repeatable when present)
let inlineInterval: NodeJS.Timeout | null = null;
let lastRun: { at: string; stats: any; mode: string } | null = null;
let nextRunAt: string | null = null;

function scheduleInline(intervalMs: number) {
  if (inlineInterval) clearInterval(inlineInterval);
  nextRunAt = new Date(Date.now() + intervalMs).toISOString();
  inlineInterval = setInterval(async () => {
    try {
      const stats = await runDiscoveryOnce();
      lastRun = { at: new Date().toISOString(), stats, mode: 'inline' };
      nextRunAt = new Date(Date.now() + intervalMs).toISOString();
      // Notification stub — write to DB notifications when enabled
      await notify({ type: 'discovery_complete', title: `Discovery: ${stats.totalInserted} new, ${stats.totalDeduped} deduped`, message: `Per-source: ${stats.perSource.map((s: any) => `${s.source}:${s.inserted}`).join(', ')}`, payload: stats as any });
      console.log('[Automation] inline discovery completed', stats);
    } catch (e: any) {
      console.warn('[Automation] inline discovery failed', e.message);
    }
  }, intervalMs);
  // Allow process to exit even if interval active (important for tests)
  if (inlineInterval.unref) inlineInterval.unref();
}

const intervalMap: Record<string, number> = {
  hourly: 60 * 60 * 1000,
  '3h': 3 * 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
};

export async function automationRoutes(app: FastifyInstance) {
  // GET /automation/status — observability (§27)
  app.get('/automation/status', async () => {
    const queue = getDiscoveryQueue();
    const counts = queue ? await queue.getJobCounts().catch(() => null) : null;
    return {
      mode: isQueueEnabled() ? 'queue' : 'inline',
      lastRun,
      nextRunAt,
      queue: counts,
      sources: ['Greenhouse (enabled)', 'LinkedIn Jobs (disabled — manual import)', 'Internshala (disabled)', 'Official company page (disabled)'],
      safeguards: { captchaStop: true, duplicateProtection: true, approvalRequired: true, autoApply: 'OFF' },
    };
  });

  // POST /automation/run — manual trigger (inline or queued)
  app.post('/automation/run', async (req, reply) => {
    const body = (req.body as any) ?? {};
    const useQueue = isQueueEnabled() && body.mode !== 'inline';
    if (useQueue) {
      const queue = getDiscoveryQueue()!;
      const job = await queue.add('discovery', {}, { jobId: `manual-${Date.now()}` });
      return { ok: true, mode: 'queued', jobId: job.id };
    }
    const stats = await runDiscoveryOnce();
    lastRun = { at: new Date().toISOString(), stats, mode: 'inline' };
    reply.code(200);
    return { ok: true, mode: 'inline', stats };
  });

  // PUT /automation/schedule — configure interval (hourly/3h/6h/daily)
  app.put('/automation/schedule', async (req, reply) => {
    const schema = z.object({ interval: z.enum(['hourly','3h','6h','daily']), enabled: z.boolean().default(true) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { reply.code(400); return { error: 'Invalid schedule', details: parsed.error.flatten() }; }
    const { interval, enabled } = parsed.data;
    if (!enabled) {
      if (inlineInterval) clearInterval(inlineInterval);
      nextRunAt = null;
      return { ok: true, enabled: false };
    }
    const ms = intervalMap[interval];
    if (isQueueEnabled()) {
      const queue = getDiscoveryQueue()!;
      await queue.add('discovery', {}, { repeat: { pattern: interval === 'hourly' ? '0 * * * *' : interval === '6h' ? '0 */6 * * *' : interval === '3h' ? '0 */3 * * *' : '0 0 * * *' }, jobId: 'scheduled-discovery' });
      nextRunAt = new Date(Date.now() + ms).toISOString();
      return { ok: true, mode: 'queue', interval, nextRunAt };
    }
    scheduleInline(ms);
    return { ok: true, mode: 'inline', interval, nextRunAt };
  });

  // POST /automation/emergency-stop — per §32
  app.post('/automation/emergency-stop', async () => {
    if (inlineInterval) clearInterval(inlineInterval);
    nextRunAt = null;
    const queue = getDiscoveryQueue();
    if (queue) await queue.pause().catch(() => {});
    return { ok: true, stopped: true };
  });

  // GET /notifications — dashboard feed + PATCH /notifications/:id/read
  app.get('/notifications', async () => {
    const prisma = getPrisma();
    if (prisma && process.env.DATABASE_URL) {
      try {
        const rows = await prisma.notification.findMany({ where: { userId: 'user-demo-nikhil' }, orderBy: { createdAt: 'desc' }, take: 20 });
        return { notifications: rows, source: 'db', unread: rows.filter(r => !r.isRead).length };
      } catch {}
    }
    return { notifications: lastRun ? [{ id: 'notif-last', title: 'Last discovery', message: `${lastRun.stats.totalInserted} new`, createdAt: lastRun.at, isRead: false }] : [], source: 'memory', unread: 0 };
  });

  app.patch('/notifications/:id/read', async (req, reply) => {
    const { id } = req.params as { id: string };
    const prisma = getPrisma();
    if (prisma && process.env.DATABASE_URL) {
      try {
        const updated = await prisma.notification.update({ where: { id }, data: { isRead: true } });
        return { ok: true, notification: updated };
      } catch { reply.code(404); return { error: 'Not found' }; }
    }
    return { ok: true, source: 'memory' };
  });

  // Auto-start scheduler: queue mode uses BullMQ repeatable, inline uses setInterval
  if (isQueueEnabled()) {
    // Start BullMQ worker so queued jobs actually run (cloud laptop OFF mode)
    startDiscoveryWorker();
    // Ensure repeatable 6h job exists
    getDiscoveryQueue()?.add('discovery', {}, { repeat: { pattern: '0 */6 * * *' }, jobId: 'scheduled-discovery' }).catch(() => {});
    nextRunAt = new Date(Date.now() + intervalMap['6h']).toISOString();
  } else if (!inlineInterval) {
    scheduleInline(intervalMap['6h']);
  }
}
