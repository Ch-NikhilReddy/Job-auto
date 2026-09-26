import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma, isDbEnabled } from '../config/db.js';
import { answerQuestions, DEFAULT_QUESTIONS } from '../services/applicationAnswerAgent.js';
import { notifyStatusChange, notifyApprovalRequired } from '../services/notification.js';

// In-memory fallback for Phase 1B when DATABASE_URL not set (AGENTS.md token-saving: keep MVP runnable)
type AppStatus = 'DISCOVERED' | 'MATCHED' | 'READY' | 'APPROVAL_REQUIRED' | 'APPROVED' | 'APPLYING' | 'APPLIED' | 'ASSESSMENT' | 'INTERVIEW' | 'OFFER' | 'REJECTED' | 'WITHDRAWN';
type Application = { id: string; jobId: string; company: string; title: string; status: AppStatus; createdAt: string; updatedAt: string; events: { type: string; at: string; data?: unknown }[] };

const memStore: Map<string, Application> = new Map();

// Seed with one demo application for dashboard (in-memory)
if (memStore.size === 0) {
  const id = 'app-demo-1';
  memStore.set(id, {
    id,
    jobId: 'job-1',
    company: 'ByteForge',
    title: 'Frontend Engineer Intern',
    status: 'APPROVAL_REQUIRED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    events: [{ type: 'DISCOVERED', at: new Date().toISOString() }, { type: 'APPROVAL_REQUIRED', at: new Date().toISOString(), data: { reason: 'Needs human approval (HUMAN_APPROVAL mode)' } }],
  });
}

const createSchema = z.object({
  jobId: z.string().min(1),
  company: z.string().min(1),
  title: z.string().min(1),
});

const statusSchema = z.object({
  status: z.enum(['DISCOVERED','MATCHED','READY','APPROVAL_REQUIRED','APPROVED','APPLYING','APPLIED','ASSESSMENT','INTERVIEW','OFFER','REJECTED','WITHDRAWN']),
  note: z.string().optional(),
});

export async function applicationRoutes(app: FastifyInstance) {
  // GET /applications — list (DB or mem)
  app.get('/applications', async () => {
    if (isDbEnabled()) {
      try {
        const prisma = getPrisma()!;
        const rows = await prisma.application.findMany({ include: { job: true }, orderBy: { updatedAt: 'desc' }, take: 50 });
        return { applications: rows, source: 'db' };
      } catch (e) {
        // fallback to mem if DB unreachable
      }
    }
    return { applications: Array.from(memStore.values()).sort((a,b)=> b.updatedAt.localeCompare(a.updatedAt)), source: 'memory' };
  });

  // GET /applications/:id — detail with events
  app.get('/applications/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (isDbEnabled()) {
      try {
        const prisma = getPrisma()!;
        const row = await prisma.application.findUnique({ where: { id }, include: { events: true, job: true, answers: true, documents: true } });
        if (row) return { application: row, source: 'db' };
      } catch {}
    }
    const found = memStore.get(id);
    if (!found) { reply.code(404); return { error: 'Application not found', id }; }
    return { application: found, source: 'memory' };
  });

  // POST /applications — create (manual import or from job) — duplicate-block by jobId
  app.post('/applications', async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) { reply.code(400); return { error: 'Invalid payload', details: parsed.error.flatten() }; }
    const { jobId, company, title } = parsed.data;

    // Duplicate check (per §10)
    const existing = Array.from(memStore.values()).find(a => a.jobId === jobId);
    if (existing) { reply.code(409); return { error: 'BLOCK DUPLICATE APPLICATION', existingId: existing.id, message: `Already applied to ${company} — ${title} (${existing.status})` }; }

    if (isDbEnabled()) {
      try {
        const prisma = getPrisma()!;
        // Use a dummy user — Phase 1 single-user; will link to real user in Phase 1C
        const dummyUserId = 'user-demo-nikhil';
        // Ensure dummy user exists
        await prisma.user.upsert({ where: { id: dummyUserId }, update: {}, create: { id: dummyUserId, email: 'nikhilreddynikhil988@gmail.com', fullName: 'Nikhil Reddy Chittepu' } });
        // Ensure dummy job exists minimally
        const job = await prisma.job.upsert({
          where: { id: jobId },
          update: {},
          create: { id: jobId, title, companyName: company, location: 'Hyderabad', description: `Manual import for ${title} at ${company}`, skills: [] },
        });
        const appRow = await prisma.application.create({
          data: { userId: dummyUserId, jobId: job.id, status: 'APPROVAL_REQUIRED', applicationUrl: null },
        });
        await prisma.applicationEvent.create({ data: { applicationId: appRow.id, eventType: 'DISCOVERED', eventData: { source: 'manual' } } });
        await prisma.applicationEvent.create({ data: { applicationId: appRow.id, eventType: 'APPROVAL_REQUIRED', eventData: { reason: 'HUMAN_APPROVAL required' } } });
        return { ok: true, application: appRow, source: 'db' };
      } catch (e: any) {
        // fall through to mem
      }
    }

    const id = `app-${Date.now()}`;
    const now = new Date().toISOString();
    const appRec: Application = { id, jobId, company, title, status: 'APPROVAL_REQUIRED', createdAt: now, updatedAt: now, events: [{ type: 'DISCOVERED', at: now }, { type: 'APPROVAL_REQUIRED', at: now }] };
    memStore.set(id, appRec);
    reply.code(201);
    return { ok: true, application: appRec, source: 'memory' };
  });

  // POST /applications/:id/approve — HUMAN_APPROVAL gate (§6 Mode B)
  app.post('/applications/:id/approve', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (isDbEnabled()) {
      try {
        const prisma = getPrisma()!;
        const row = await prisma.application.findUnique({ where: { id } });
        if (row) {
          const updated = await prisma.application.update({ where: { id }, data: { status: 'APPROVED', approvedAt: new Date() } });
          await prisma.applicationEvent.create({ data: { applicationId: id, eventType: 'APPROVED', eventData: { by: 'user' } } });
          return { ok: true, application: updated, source: 'db' };
        }
      } catch {}
    }
    const found = memStore.get(id);
    if (!found) { reply.code(404); return { error: 'Not found' }; }
    found.status = 'APPROVED';
    found.updatedAt = new Date().toISOString();
    found.events.push({ type: 'APPROVED', at: found.updatedAt, data: { by: 'user' } });
    return { ok: true, application: found, source: 'memory' };
  });

  // POST /applications/:id/prepare — aggregate for Human Approval (§6 Mode B + §15)
  app.post('/applications/:id/prepare', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body as any) ?? {};
    const questionsInput = (body.questions as { key: string; text: string }[] | undefined) ?? DEFAULT_QUESTIONS;

    // Fetch application + job
    let appRow: any = null;
    let job: any = null;
    if (isDbEnabled()) {
      try {
        const prisma = getPrisma()!;
        appRow = await prisma.application.findUnique({ where: { id }, include: { job: true, documents: true, events: true } });
        if (appRow?.job) job = { title: appRow.job.title, company: appRow.job.companyName, location: appRow.job.location, description: appRow.job.description, skills: (appRow.job.skills as string[]) ?? [] };
      } catch {}
    }
    if (!appRow) {
      const found = memStore.get(id);
      if (!found) { reply.code(404); return { error: 'Application not found', id }; }
      appRow = found;
      // Try to resolve job from seeded/manual
      const { discoverJobs } = await import('../services/jobDiscovery.js');
      const all = discoverJobs();
      const j = all.find(x => x.id === found.jobId);
      if (j) job = { title: j.title, company: j.company, location: j.location, description: j.description, skills: j.skills };
    }
    if (!job) job = { title: appRow.title ?? 'Role', company: appRow.company ?? appRow.job?.companyName ?? 'Company', location: 'Hyderabad', description: '', skills: [] };

    const answers = answerQuestions(job, questionsInput.map(q => ({ key: q.key, text: q.text })));
    const needsUser = answers.filter(a => a.needsUser);

    // Persist answers that are auto-answered (high confidence) — UNKNOWN stays pending
    if (isDbEnabled()) {
      try {
        const prisma = getPrisma()!;
        for (const a of answers) {
          if (!a.needsUser) {
            await prisma.applicationAnswer.upsert({
              where: { id: `${id}-${a.key}` } as any, // id is cuid, so use createMany fallback
              update: { answerText: a.answer, isApproved: false },
              create: { id: `${id}-${a.key}-${Date.now()}`, applicationId: id, questionKey: a.key, questionText: a.question, answerText: a.answer || '(needs user)', answeredBy: a.source === 'UNKNOWN' ? 'system-flagged' : 'system', isApproved: false },
            } as any).catch(async () => {
              await prisma.applicationAnswer.create({ data: { applicationId: id, questionKey: a.key, questionText: a.question, answerText: a.answer || '(needs user)', answeredBy: a.source, isApproved: false } });
            });
          } else {
            await prisma.applicationAnswer.create({ data: { applicationId: id, questionKey: a.key, questionText: a.question, answerText: '(FLAG FOR USER)', answeredBy: 'system-flagged', isApproved: false } }).catch(()=>{});
          }
        }
        // Ensure status is APPROVAL_REQUIRED (never downgrade APPROVED/APPLIED/etc)
        await prisma.application.updateMany({
          where: { id, status: { in: ['DISCOVERED', 'MATCHED', 'READY', 'APPROVAL_REQUIRED'] } },
          data: { status: 'APPROVAL_REQUIRED' },
        }).catch(()=>{});
        await prisma.applicationEvent.create({ data: { applicationId: id, eventType: 'PREPARED_FOR_APPROVAL', eventData: { answersCount: answers.length, needsUser: needsUser.length } as any } }).catch(()=>{});
        await notifyApprovalRequired(id, job.title).catch(()=>{});
      } catch {}
    }

    return {
      ok: true,
      application: appRow,
      job,
      answers,
      needsUser,
      approvalRequired: needsUser.length > 0 || answers.length > 0,
      actions: { approve: `/applications/${id}/approve`, edit: `/applications/${id}/answers`, skip: `/applications/${id}/status with REJECTED/WITHDRAWN` },
      mode: 'HUMAN_APPROVAL',
    };
  });

  // PATCH /applications/:id/answers — EDIT answers before approval (§6)
  app.patch('/applications/:id/answers', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = z.object({ answers: z.array(z.object({ key: z.string(), answer: z.string() })) }).safeParse(req.body);
    if (!parsed.success) { reply.code(400); return { error: 'Invalid answers', details: parsed.error.flatten() }; }
    if (isDbEnabled()) {
      try {
        const prisma = getPrisma()!;
        for (const a of parsed.data.answers) {
          const updated = await prisma.applicationAnswer.updateMany({ where: { applicationId: id, questionKey: a.key }, data: { answerText: a.answer, isApproved: true, answeredBy: 'user' } });
          if (updated.count === 0) {
            // No prior row for this key — create one so the answer is persisted
            await prisma.applicationAnswer.create({ data: { applicationId: id, questionKey: a.key, questionText: a.key, answerText: a.answer, isApproved: true, answeredBy: 'user' } });
          }
        }
        await prisma.applicationEvent.create({ data: { applicationId: id, eventType: 'ANSWERS_EDITED', eventData: { keys: parsed.data.answers.map(a => a.key) } } });
        return { ok: true, updated: parsed.data.answers.length };
      } catch {}
    }
    return { ok: true, updated: parsed.data.answers.length, source: 'memory' };
  });

  // POST /applications/:id/submit — Phase 7 permitted submission (§7)
  app.post('/applications/:id/submit', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!isDbEnabled()) { reply.code(503); return { error: 'DB required for submit', hint: 'Set DATABASE_URL' }; }
    try {
      const { canAutoSubmit } = await import('../services/applicationExecutor.js');
      const { ok, checks, job, application } = await canAutoSubmit(id);
      if (!ok) {
        reply.code(422);
        return { ok: false, error: 'SUBMIT_BLOCKED', checks, job: { title: job.title, company: job.companyName }, application: { id: application.id, status: application.status }, message: 'Blocked by safe criteria — fix blockers and ensure APPROVED status before submit. Use human approval workflow (§6 Mode B).' };
      }
      const prisma = getPrisma()!;
      // Simulate permitted submission: mark APPLIED (real browser automation would run here per §20)
      // Per §3: only via permitted mechanism — currently link-out/manual for most sources, so we record as APPLIED with applicationUrl
      const updated = await prisma.application.update({ where: { id }, data: { status: 'APPLIED', applicationUrl: (job as any).sourceUrl ?? null } });
      await prisma.applicationEvent.create({ data: { applicationId: id, eventType: 'APPLIED', eventData: { via: 'permitted-executor', checks } as any } });
      await prisma.notification.create({ data: { userId: (application as any).userId, type: 'application_submitted', channel: 'dashboard', title: `Applied: ${job.title} at ${job.companyName}`, message: `Application ${id} submitted via permitted mechanism`, payload: { jobId: (job as any).id } as any } }).catch(()=>{});
      return { ok: true, application: updated, checks, message: 'Application marked APPLIED — for non-API sources, open applicationUrl to complete manual step if needed.' };
    } catch (e: any) {
      reply.code(400);
      return { error: e.message };
    }
  });

  // GET /applications/:id/check — dry-run safe criteria without submitting
  app.get('/applications/:id/check', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!isDbEnabled()) { reply.code(503); return { error: 'DB required' }; }
    try {
      const { canAutoSubmit } = await import('../services/applicationExecutor.js');
      const result = await canAutoSubmit(id);
      return { ok: result.ok, checks: result.checks, job: { title: result.job.title, company: result.job.companyName }, application: { id: result.application.id, status: result.application.status } };
    } catch (e: any) {
      reply.code(404); return { error: e.message };
    }
  });

  // PATCH /applications/:id/status — generic status progression (§11 pipeline)
  app.patch('/applications/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) { reply.code(400); return { error: 'Invalid status', details: parsed.error.flatten() }; }
    const { status, note } = parsed.data;
    if (isDbEnabled()) {
      try {
        const prisma = getPrisma()!;
        const row = await prisma.application.findUnique({ where: { id } });
        if (row) {
          const updated = await prisma.application.update({ where: { id }, data: { status, updatedAt: new Date() } });
          await prisma.applicationEvent.create({ data: { applicationId: id, eventType: status, eventData: note ? { note } : {} } });
          await notifyStatusChange(id, status).catch(()=>{});
          return { ok: true, application: updated, source: 'db' };
        }
      } catch {}
    }
    const found = memStore.get(id);
    if (!found) { reply.code(404); return { error: 'Not found' }; }
    found.status = status as AppStatus;
    found.updatedAt = new Date().toISOString();
    found.events.push({ type: status, at: found.updatedAt, data: note ? { note } : undefined });
    return { ok: true, application: found, source: 'memory' };
  });
}
