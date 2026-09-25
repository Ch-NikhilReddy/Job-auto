import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma, isDbEnabled } from '../config/db.js';

const interviewSchema = z.object({
  title: z.string().min(1),
  scheduledAt: z.string().min(1), // ISO
  venueOrLink: z.string().optional(),
  notes: z.string().optional(),
});

export async function timelineRoutes(app: FastifyInstance) {
  // GET /applications/:id/timeline — §15 status history + interview details
  app.get('/applications/:id/timeline', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!isDbEnabled()) { reply.code(503); return { error: 'DB required' }; }
    try {
      const prisma = getPrisma()!;
      const appRow = await prisma.application.findUnique({ where: { id }, include: { job: true } });
      if (!appRow) { reply.code(404); return { error: 'Application not found' }; }
      const events = await prisma.applicationEvent.findMany({ where: { applicationId: id }, orderBy: { createdAt: 'asc' } });
      const interviews = await prisma.interviewEvent.findMany({ where: { applicationId: id }, orderBy: { scheduledAt: 'asc' } });
      const docs = await prisma.applicationDocument.findMany({ where: { applicationId: id } });
      const answers = await prisma.applicationAnswer.findMany({ where: { applicationId: id } });
      return { application: appRow, job: appRow.job, events, interviews, documents: docs, answers, pipeline: ['DISCOVERED','MATCHED','READY','APPROVAL_REQUIRED','APPROVED','APPLYING','APPLIED','ASSESSMENT','INTERVIEW','OFFER','REJECTED','WITHDRAWN'] };
    } catch (e: any) {
      reply.code(500); return { error: e.message };
    }
  });

  // POST /applications/:id/interview — schedule interview
  app.post('/applications/:id/interview', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = interviewSchema.safeParse(req.body);
    if (!parsed.success) { reply.code(400); return { error: 'Invalid interview', details: parsed.error.flatten() }; }
    if (!isDbEnabled()) { reply.code(503); return { error: 'DB required' }; }
    try {
      const prisma = getPrisma()!;
      const interview = await prisma.interviewEvent.create({
        data: {
          applicationId: id,
          title: parsed.data.title,
          scheduledAt: new Date(parsed.data.scheduledAt),
          venueOrLink: parsed.data.venueOrLink,
          notes: parsed.data.notes,
        },
      });
      await prisma.application.update({ where: { id }, data: { status: 'INTERVIEW' } });
      await prisma.applicationEvent.create({ data: { applicationId: id, eventType: 'INTERVIEW', eventData: { interviewId: interview.id, title: interview.title } as any } });
      reply.code(201);
      return { ok: true, interview };
    } catch (e: any) {
      reply.code(400); return { error: e.message };
    }
  });

  // GET /analytics/status — §30 distribution
  app.get('/analytics/status', async () => {
    if (!isDbEnabled()) return { source: 'memory', distribution: {} };
    try {
      const prisma = getPrisma()!;
      const groups = await prisma.application.groupBy({ by: ['status'], _count: { _all: true } });
      const distribution: Record<string, number> = {};
      for (const g of groups) distribution[g.status] = g._count._all;
      const bySource = await prisma.job.groupBy({ by: ['sourceId'], _count: { _all: true } }).catch(()=> []);
      return { distribution, bySource, source: 'db' };
    } catch (e: any) {
      return { error: e.message };
    }
  });
}
