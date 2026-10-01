import type { FastifyInstance } from 'fastify';
import { allOutreachTemplates, buildOutreach, draftEmailsForJobs, type OutreachKind } from '../services/outreach.js';
import { getPrisma, isDbEnabled } from '../config/db.js';

const KINDS: OutreachKind[] = ['alumni', 'recruiter', 'referral', 'cold_dm'];

export async function outreachRoutes(app: FastifyInstance) {
  // GET /outreach/templates — ready-to-send messages (§7 grounded in profile only)
  app.get('/outreach/templates', async () => ({ templates: allOutreachTemplates() }));

  app.get('/outreach/templates/:kind', async (req, reply) => {
    const { kind } = req.params as { kind: string };
    if (!KINDS.includes(kind as OutreachKind)) { reply.code(400); return { error: 'Unknown kind', kinds: KINDS }; }
    return { template: buildOutreach(kind as OutreachKind) };
  });

  // GET /outreach/drafts — per-job recruiter emails for the top matches
  app.get('/outreach/drafts', async (req, reply) => {
    if (!isDbEnabled()) { reply.code(503); return { error: 'DB required' }; }
    try {
      const prisma = getPrisma()!;
      const matches = await prisma.jobMatch.findMany({
        where: { score: { gte: 55 } },
        include: { job: true },
        orderBy: { score: 'desc' },
        take: 15,
      });
      const drafts = draftEmailsForJobs(
        matches.map((m: any) => ({ title: m.job.title, company: m.job.companyName, score: m.score }))
      );
      return { count: drafts.length, drafts };
    } catch (e: any) {
      reply.code(500); return { error: e.message };
    }
  });
}
