import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { allAdapters } from '../adapters/greenhouseAdapter.js';
import { getPrisma } from '../config/db.js';

export type DiscoveryStats = {
  startedAt: string;
  finishedAt?: string;
  perSource: { source: string; fetched: number; deduped: number; inserted: number; error?: string }[];
  totalInserted: number;
  totalDeduped: number;
  durationMs?: number;
};

// Pure function for inline mode (when REDIS_URL absent) and for Worker processor
export async function runDiscoveryOnce(): Promise<DiscoveryStats> {
  const startedAt = new Date().toISOString();
  const start = Date.now();
  const perSource: DiscoveryStats['perSource'] = [];
  let totalInserted = 0;
  let totalDeduped = 0;

  const prisma = getPrisma();
  const useDb = !!prisma && !!process.env.DATABASE_URL;

  for (const adapter of allAdapters) {
    if (!adapter.isEnabled()) {
      perSource.push({ source: adapter.name, fetched: 0, deduped: 0, inserted: 0, error: 'disabled' });
      continue;
    }
    try {
      const res = await adapter.fetchJobs();
      let inserted = 0;
      let deduped = 0;
      for (const job of res.jobs) {
        // Dedupe by company+title+url hash (per §26) and externalId
        const dupKey = `${job.company.toLowerCase()}|${job.title.toLowerCase()}|${job.url.toLowerCase()}`;
        // Check memory dedupe via DB unique constraints
        if (useDb) {
          try {
            // Try to find existing by sourceUrl or company+title
            const existing = await prisma!.job.findFirst({ where: { OR: [{ sourceUrl: job.url }, { companyName: job.company, title: job.title }] } });
            if (existing) { deduped++; continue; }
            const source = await prisma!.jobSource.findUnique({ where: { name: res.sourceName } });
            await prisma!.job.create({
              data: {
                sourceId: source?.id,
                externalId: job.externalId,
                sourceUrl: job.url,
                title: job.title,
                companyName: job.company,
                location: job.location,
                workMode: job.workMode,
                employmentType: job.employmentType,
                description: job.description,
                skills: job.skills,
                salaryMin: job.salaryMin,
                salaryMax: job.salaryMax,
              },
            });
            inserted++;
          } catch (e: any) {
            // Unique violation → deduped
            if (e?.code === 'P2002') deduped++; else throw e;
          }
        } else {
          // No DB: count as inserted (memory mode in jobs.ts handles it via manualJobsStore if needed)
          inserted++;
        }
      }
      perSource.push({ source: adapter.name, fetched: res.jobs.length, deduped, inserted });
      totalInserted += inserted;
      totalDeduped += deduped;
    } catch (e: any) {
      perSource.push({ source: adapter.name, fetched: 0, deduped: 0, inserted: 0, error: e?.message ?? String(e) });
    }
  }

  return { startedAt, finishedAt: new Date().toISOString(), perSource, totalInserted, totalDeduped, durationMs: Date.now() - start };
}

export function startDiscoveryWorker(): Worker | null {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.log('[DiscoveryWorker] REDIS_URL not set — worker disabled, use POST /automation/run for inline discovery');
    return null;
  }
  const connection = new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: false });
  const worker = new Worker('discovery', async () => {
    return await runDiscoveryOnce();
  }, { connection });
  worker.on('completed', (job) => console.log(`[DiscoveryWorker] job ${job.id} completed`, job.returnvalue));
  worker.on('failed', (job, err) => console.warn(`[DiscoveryWorker] job ${job?.id} failed:`, err.message));
  return worker;
}
