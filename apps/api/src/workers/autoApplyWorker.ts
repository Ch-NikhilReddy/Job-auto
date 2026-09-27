// Auto-apply queue worker — processes approved applications with no per-application human step
import { Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { applyToApplication, APPLY_STATUS } from '../services/autoApplier.js';
import { getPrisma } from '../config/db.js';
import { notify } from '../services/notification.js';

export const AUTO_APPLY_QUEUE = 'auto-apply';

export type AutoApplyJobData = { applicationId: string };

export async function enqueueAutoApply(applicationId: string): Promise<{ queued: boolean; jobId?: string }> {
  const url = process.env.REDIS_URL;
  if (!url) return { queued: false };
  const { getDiscoveryQueue } = await import('../queue/queue.js');
  const q = getDiscoveryQueue();
  if (!q) return { queued: false };
  const job = await q.add('auto-apply', { applicationId } satisfies AutoApplyJobData, {
    jobId: `autoapply-${applicationId}`,
    attempts: 2,
    backoff: { type: 'exponential', delay: 8000 },
    removeOnComplete: 200,
    removeOnFail: 100,
  });
  return { queued: true, jobId: job.id };
}

/** Sweep: every APPROVED application becomes APPLYING and gets queued. No human step. */
export async function sweepAutoApply(opts: { limit?: number } = {}): Promise<{ scanned: number; queued: string[]; skipped: string[]; reasons: Record<string, string> }> {
  const prisma = getPrisma();
  const reasons: Record<string, string> = {};
  if (!prisma) return { scanned: 0, queued: [], skipped: [], reasons: { db: 'DB not enabled' } };

  const limit = opts.limit ?? Number(process.env.AUTO_APPLY_DAILY_LIMIT ?? 20);
  const apps = await prisma.application.findMany({
    where: { status: { in: ['APPROVED', 'APPLYING'] } },
    include: { job: true, answers: true },
    orderBy: { updatedAt: 'asc' },
    take: limit,
  });

  const queued: string[] = [];
  const skipped: string[] = [];
  for (const a of apps) {
    const job: any = a.job;
    const url = job?.sourceUrl ?? '';
    if (!url) { skipped.push(a.id); reasons[a.id] = 'No applicationUrl'; continue; }

    const hasUnknown = a.answers.some((x: any) => x.answeredBy !== 'user' && (x.answerText === '(FLAG FOR USER)' || x.answerText === ''));
    if (hasUnknown) { skipped.push(a.id); reasons[a.id] = 'UNKNOWN answers not provided by user'; continue; }

    const { isDomainAllowed } = await import('../services/autoApplier.js');
    const gate = isDomainAllowed(url);
    if (!gate.allowed) { skipped.push(a.id); reasons[a.id] = gate.reason; continue; }

    if (a.status === 'APPROVED') {
      await prisma.application.update({ where: { id: a.id }, data: { status: APPLY_STATUS.APPLYING, submissionMethod: 'browser_automated' } }).catch(() => {});
    }
    const r = await enqueueAutoApply(a.id);
    if (r.queued) queued.push(a.id);
    else { skipped.push(a.id); reasons[a.id] = 'Queue unavailable (REDIS_URL missing)'; }
  }

  await notify({ type: 'auto_apply_sweep', title: `Auto-apply sweep: ${queued.length} queued, ${skipped.length} skipped`, message: reasons ? Object.entries(reasons).map(([k, v]) => v).slice(0, 3).join(' | ') : 'All queued', payload: { queued, skipped, reasons } });
  return { scanned: apps.length, queued, skipped, reasons };
}

export function startAutoApplyWorker(): Worker | null {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.log('[AutoApplyWorker] REDIS_URL not set — queue disabled (sweep will skip)');
    return null;
  }
  const connection = new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: false });
  const worker = new Worker(
    'discovery',
    async (job: Job) => {
      if (job.name === 'auto-apply-sweep') {
        const r = await sweepAutoApply({});
        console.log(`[AutoApplyWorker] sweep -> queued ${r.queued.length}, skipped ${r.skipped.length}`);
        return r;
      }
      if (job.name !== 'auto-apply') return null;
      const { applicationId } = job.data as AutoApplyJobData;
      console.log(`[AutoApplyWorker] applying ${applicationId}`);
      return await applyToApplication(applicationId);
    },
    { connection, concurrency: Number(process.env.AUTO_APPLY_CONCURRENCY ?? 2) }
  );
  worker.on('completed', (job) => console.log(`[AutoApplyWorker] ${job.id} ->`, (job.returnvalue as any)?.status));
  worker.on('failed', (job, err) => console.warn(`[AutoApplyWorker] ${job?.id} failed:`, err.message));

  // Recurring zero-touch sweep — no per-application human step
  const cron = process.env.AUTO_APPLY_SWEEP_CRON;
  if (cron) {
    import('../queue/queue.js')
      .then(({ getDiscoveryQueue }) =>
        getDiscoveryQueue()
          ?.add('auto-apply-sweep', {}, { jobId: 'auto-apply-sweep', repeat: { pattern: cron } })
          .catch(() => {})
      )
      .catch(() => {});
  }
  return worker;
}
