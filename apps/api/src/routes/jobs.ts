import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { scoreJobMatch, type JobPreference } from '../utils/jobMatcher.js';
import { discoverJobs } from '../services/jobDiscovery.js';
import { getPrisma, isDbEnabled } from '../config/db.js';

const jobSchema = z.object({
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().min(1),
  workMode: z.enum(['remote', 'hybrid', 'onsite']).default('hybrid'),
  employmentType: z.enum(['internship', 'full-time', 'part-time', 'contract']).default('internship'),
  skills: z.array(z.string()).default([]),
  description: z.string().default(''),
});

const manualJobSchema = z.object({
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().min(1),
  workMode: z.enum(['remote', 'hybrid', 'onsite']).default('hybrid'),
  employmentType: z.enum(['internship', 'full-time', 'part-time', 'contract']).default('internship'),
  skills: z.array(z.string()).default([]),
  description: z.string().min(1),
  url: z.string().url().optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  sourceName: z.string().default('Manual import'),
});

// In-memory stores for Phase 1C (fallback when DATABASE_URL absent)
const manualJobsStore: Map<string, any> = new Map();
const savedJobsStore: Set<string> = new Set(); // jobId set for single-user demo

const querySchema = z.object({
  query: z.string().optional(),
  location: z.string().optional(),
  employmentType: z.string().optional(),
  workMode: z.string().optional(),
});

export async function jobsRoutes(app: FastifyInstance) {
  app.get('/jobs', async (request) => {
    const parsed = querySchema.safeParse(request.query);
    const filters = parsed.success ? parsed.data : {};
    const seeded = discoverJobs(filters);
    const manual = Array.from(manualJobsStore.values()).filter((j) => {
      const text = `${j.title} ${j.company} ${j.description} ${j.skills.join(' ')}`.toLowerCase();
      const q = (filters.query ?? '').toLowerCase();
      return !q || text.includes(q);
    });
    const all = [...manual, ...seeded];
    return {
      jobs: all.map((job) => ({
        ...job,
        salaryRange: job.salary ? `${job.salary.currency ?? 'INR'} ${job.salary.min ?? 0} - ${job.salary.max ?? 0}` : 'Not disclosed',
        isSaved: savedJobsStore.has(job.id),
      })),
      total: all.length,
      savedCount: savedJobsStore.size,
    };
  });

  // GET /jobs/:id — detail (needed for Job Card)
  app.get('/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const all = [...Array.from(manualJobsStore.values()), ...discoverJobs()];
    const found = all.find(j => j.id === id);
    if (!found) { reply.code(404); return { error: 'Job not found', id }; }
    return { job: { ...found, isSaved: savedJobsStore.has(id) } };
  });

  app.post('/jobs/match', async (request) => {
    const parsed = jobSchema.safeParse(request.body);

    if (!parsed.success) {
      return { error: 'Invalid job payload', details: parsed.error.flatten() };
    }

    const { nikhilProfile } = await import('../data/profile.js');
    const userProfile: JobPreference = {
      role: 'internship',
      preferredLocations: [...nikhilProfile.preferredLocations],
      remoteOk: true,
      workMode: 'hybrid',
      preferredRoles: [...nikhilProfile.preferredRoles],
      skills: [...nikhilProfile.skills],
    };

    const job = {
      ...parsed.data,
      id: `job-${Date.now()}`,
      company: parsed.data.company,
      description: parsed.data.description || 'Opportunity matched against the user profile.',
    };

    return scoreJobMatch({ ...userProfile, graduationYear: 2027, education: 'B.Tech IT' }, job);
  });

  // POST /jobs/:id/analyze — §5 transparent matching (stores JobMatch per §12)
  app.post('/jobs/:id/analyze', async (request, reply) => {
    const { id } = request.params as { id: string };
    // Resolve job from DB first, then seeded/manual memory
    let job: any = null;
    if (isDbEnabled()) {
      try {
        const prisma = getPrisma()!;
        const row = await prisma.job.findUnique({ where: { id } });
        if (row) {
          job = { id: row.id, title: row.title, company: row.companyName, location: row.location, workMode: row.workMode, employmentType: row.employmentType, skills: (row.skills as string[]) ?? [], description: row.description };
        }
      } catch {}
    }
    if (!job) {
      const all = [...Array.from(manualJobsStore.values()), ...discoverJobs()];
      job = all.find(j => j.id === id);
    }
    if (!job) { reply.code(404); return { error: 'Job not found', id }; }

    const { nikhilProfile } = await import('../data/profile.js');
    const userProfile: JobPreference = {
      role: 'internship',
      preferredLocations: [...nikhilProfile.preferredLocations],
      remoteOk: true,
      workMode: 'hybrid',
      preferredRoles: [...nikhilProfile.preferredRoles],
      skills: [...nikhilProfile.skills],
      graduationYear: 2027,
      education: 'B.Tech IT',
    };
    const result = scoreJobMatch(userProfile, job);

    // Persist JobMatch per §12 (§5 individual reasons, not just score) — deduped by userId+jobId
    if (isDbEnabled()) {
      try {
        const prisma = getPrisma()!;
        await prisma.jobMatch.upsert({
          where: { userId_jobId: { userId: 'user-demo-nikhil', jobId: job.id } },
          update: { score: result.score, matchingSkills: result.matchingSkills, missingSkills: result.missingSkills, blockers: result.hardBlockers, reasoning: result.reasoning, recommendedAction: result.recommendedAction },
          create: {
            userId: 'user-demo-nikhil',
            jobId: job.id,
            score: result.score,
            matchingSkills: result.matchingSkills,
            missingSkills: result.missingSkills,
            blockers: result.hardBlockers,
            reasoning: result.reasoning,
            recommendedAction: result.recommendedAction,
          },
        });
      } catch {}
    }

    return { job, match: result };
  });

  // GET /jobs/:id/match — alias for analyze (for Job Card)
  app.get('/jobs/:id/match', async (request, reply) => {
    // Reuse analyze logic via internal call
    const { id } = request.params as { id: string };
    // Forward to analyze handler
    (request.params as any).id = id;
    // Call same as above inline
    let job: any = null;
    if (isDbEnabled()) {
      try {
        const prisma = getPrisma()!;
        const row = await prisma.job.findUnique({ where: { id } });
        if (row) job = { id: row.id, title: row.title, company: row.companyName, location: row.location, workMode: row.workMode, employmentType: row.employmentType, skills: (row.skills as string[]) ?? [], description: row.description };
      } catch {}
    }
    if (!job) {
      const all = [...Array.from(manualJobsStore.values()), ...discoverJobs()];
      job = all.find(j => j.id === id);
    }
    if (!job) { reply.code(404); return { error: 'Job not found', id }; }
    const { nikhilProfile } = await import('../data/profile.js');
    const userProfile: JobPreference = {
      role: 'internship', preferredLocations: [...nikhilProfile.preferredLocations], remoteOk: true, workMode: 'hybrid', preferredRoles: [...nikhilProfile.preferredRoles], skills: [...nikhilProfile.skills], graduationYear: 2027, education: 'B.Tech IT',
    };
    const result = scoreJobMatch(userProfile, job);
    return { job, match: result };
  });

  // POST /jobs/manual-import — §7 Manual import (dedupe per §10)
  app.post('/jobs/manual-import', async (request, reply) => {
    const parsed = manualJobSchema.safeParse(request.body);
    if (!parsed.success) { reply.code(400); return { error: 'Invalid job payload', details: parsed.error.flatten() }; }
    const data = parsed.data;

    // Dedupe by company+title+url (memory) or externalId+sourceUrl (DB)
    const dupKey = `${data.company.toLowerCase()}|${data.title.toLowerCase()}|${(data.url ?? '').toLowerCase()}`;
    const dup = Array.from(manualJobsStore.values()).find(j => `${j.company.toLowerCase()}|${j.title.toLowerCase()}|${(j.url ?? '').toLowerCase()}` === dupKey);
    if (dup) { reply.code(409); return { error: 'Duplicate job', existingId: dup.id, message: `Job already imported: ${dup.title} at ${dup.company}` }; }

    const id = `manual-${Date.now()}`;
    const job = {
      id,
      sourceName: data.sourceName,
      title: data.title,
      company: data.company,
      location: data.location,
      workMode: data.workMode,
      employmentType: data.employmentType,
      skills: data.skills,
      description: data.description,
      url: data.url ?? `https://example.com/jobs/${id}`,
      salary: (data.salaryMin || data.salaryMax) ? { min: data.salaryMin, max: data.salaryMax, currency: 'INR' } : undefined,
      postedAt: new Date().toISOString().slice(0,10),
    };
    manualJobsStore.set(id, job);

    if (isDbEnabled()) {
      try {
        const prisma = getPrisma()!;
        const dummyUserId = 'user-demo-nikhil';
        await prisma.user.upsert({ where: { id: dummyUserId }, update: {}, create: { id: dummyUserId, email: 'nikhilreddynikhil988@gmail.com', fullName: 'Nikhil Reddy Chittepu' } });
        await prisma.job.create({
          data: {
            id,
            userId: dummyUserId,
            title: job.title,
            companyName: job.company,
            location: job.location,
            workMode: job.workMode,
            employmentType: job.employmentType,
            description: job.description,
            skills: job.skills,
            sourceUrl: job.url,
            salaryMin: data.salaryMin,
            salaryMax: data.salaryMax,
          },
        });
      } catch {}
    }

    reply.code(201);
    return { ok: true, job, source: isDbEnabled() ? 'db+memory' : 'memory' };
  });

  // POST /jobs/:id/save — toggle saved (SavedJob §6)
  app.post('/jobs/:id/save', async (request, reply) => {
    const { id } = request.params as { id: string };
    const all = [...Array.from(manualJobsStore.values()), ...discoverJobs()];
    if (!all.find(j => j.id === id)) { reply.code(404); return { error: 'Job not found', id }; }
    const wasSaved = savedJobsStore.has(id);
    if (wasSaved) savedJobsStore.delete(id); else savedJobsStore.add(id);

    if (isDbEnabled()) {
      try {
        const prisma = getPrisma()!;
        const dummyUserId = 'user-demo-nikhil';
        if (wasSaved) {
          await prisma.savedJob.deleteMany({ where: { userId: dummyUserId, jobId: id } });
        } else {
          await prisma.savedJob.upsert({ where: { userId_jobId: { userId: dummyUserId, jobId: id } }, update: {}, create: { userId: dummyUserId, jobId: id } });
        }
      } catch {}
    }

    return { ok: true, jobId: id, isSaved: !wasSaved, savedCount: savedJobsStore.size };
  });

  // GET /saved-jobs — list saved
  app.get('/saved-jobs', async () => {
    const all = [...Array.from(manualJobsStore.values()), ...discoverJobs()];
    const saved = all.filter(j => savedJobsStore.has(j.id));
    return { savedJobs: saved, count: saved.length };
  });

  // GET /dashboard — summary for dashboard metrics (augments routes/dashboard.ts if needed)
  app.get('/dashboard/summary', async () => {
    const seeded = discoverJobs();
    const manual = Array.from(manualJobsStore.values());
    return {
      totalJobs: seeded.length + manual.length,
      seededCount: seeded.length,
      manualCount: manual.length,
      savedCount: savedJobsStore.size,
    };
  });
}
