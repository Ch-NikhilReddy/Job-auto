import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import fs from 'fs';
import { getPrisma, isDbEnabled } from '../config/db.js';
import { tailorResumeForJob } from '../services/resumeAgent.js';
import { generateCoverLetter } from '../services/coverLetterAgent.js';
import { generateTailoredResumeDocx, generateCoverLetterPdf } from '../services/docxGenerator.js';
import { fullQACheck } from '../services/qaAgent.js';

export async function documentRoutes(app: FastifyInstance) {
  // POST /jobs/:id/prepare — §4 generate tailored resume + cover letter (truthful, per §23)
  app.post('/jobs/:id/prepare', async (req, reply) => {
    const { id } = req.params as { id: string };
    let job: any = null;
    if (isDbEnabled()) {
      try {
        const prisma = getPrisma()!;
        const row = await prisma.job.findUnique({ where: { id } });
        if (row) job = { id: row.id, title: row.title, company: row.companyName, location: row.location, workMode: row.workMode, employmentType: row.employmentType, skills: (row.skills as string[]) ?? [], description: row.description };
      } catch {}
    }
    if (!job) {
      const { discoverJobs } = await import('../services/jobDiscovery.js');
      const { seededJobs } = await import('../data/jobs.js');
      // Also check manual store via jobs route import is not accessible; fetch via discoverJobs plus try manualJobs via DB already checked
      const all = discoverJobs();
      const found = all.find(j => j.id === id) ?? (await import('../data/jobs.js')).seededJobs.find(j => j.id === id);
      if (found) job = { id: found.id, title: found.title, company: found.company, location: found.location, workMode: found.workMode, employmentType: found.employmentType, skills: found.skills, description: found.description };
    }
    if (!job) { reply.code(404); return { error: 'Job not found', id }; }

    const tailored = tailorResumeForJob(job);
    const cover = generateCoverLetter(job, tailored);

    // P4-008: QA Gate — uses your resumes as truth source (§23/§35) — blocks invented skills/projects
    const qa = fullQACheck(job, tailored, cover);
    if (!qa.ok) {
      // Do NOT generate files if hard blockers — return QA report for user to fix (per §6 Mode B)
      reply.code(422);
      return { ok: false, error: 'QA_BLOCKED', qa, job, tailoredResume: tailored, coverLetter: cover, message: 'Blocked: invented qualifications or missing required user confirmation. Fix before approval.' };
    }

    const resumeFile = await generateTailoredResumeDocx(job, tailored);
    const coverFile = await generateCoverLetterPdf(job, cover);

    // Persist as ApplicationDocuments if applicationId given
    const applicationId = (req.query as any)?.applicationId as string | undefined;
    if (applicationId && isDbEnabled()) {
      try {
        const prisma = getPrisma()!;
        const appRow = await prisma.application.findUnique({ where: { id: applicationId } });
        if (appRow) {
          await prisma.applicationDocument.createMany({
            data: [
              { applicationId, documentType: 'resume_tailored', fileKey: resumeFile.fileKey, fileName: resumeFile.fileName },
              { applicationId, documentType: 'cover_letter', fileKey: coverFile.fileKey, fileName: coverFile.fileName },
            ],
          });
          await prisma.applicationEvent.create({ data: { applicationId, eventType: 'DOCUMENTS_PREPARED', eventData: { jobId: id, tailored, cover, files: { resume: resumeFile.fileKey, cover: coverFile.fileKey } } as any } });
        }
      } catch {}
    } else if (isDbEnabled()) {
      // Also log event without application for history
      try {
        const prisma = getPrisma()!;
        // No application — just ensure files are tracked via audit
      } catch {}
    }

    return {
      ok: true,
      job,
      tailoredResume: tailored,
      coverLetter: cover,
      qa, // P4-008: show warnings even when ok (e.g., visa UNKNOWN)
      files: { resume: resumeFile, cover: coverFile, download: { resumeUrl: `/documents/${encodeURIComponent(resumeFile.fileKey)}/download`, coverUrl: `/documents/${encodeURIComponent(coverFile.fileKey)}/download` } },
      truthfulness: 'All skills/projects traced to profile.json — no invented qualifications per §23/§35',
    };
  });

  // GET /documents/:fileKey/download — serve from S3 or local fallback (§33)
  app.get('/documents/:fileKey/download', async (req, reply) => {
    const { fileKey } = req.params as { fileKey: string };
    const decoded = decodeURIComponent(fileKey);
    if (!decoded.startsWith('generated/') || decoded.includes('..')) { reply.code(400); return { error: 'Invalid fileKey' }; }
    const { downloadFromStorage } = await import('../services/storage.js');
    const data = await downloadFromStorage(decoded);
    if (!data) { reply.code(404); return { error: 'File not found', fileKey: decoded }; }
    reply.header('Content-Type', data.contentType);
    reply.header('Content-Disposition', `attachment; filename="${decoded.split('/').pop()}"`);
    return reply.send(data.body);
  });

  // GET /applications/:id/documents — §15 show resume used + cover letter + answers
  app.get('/applications/:id/documents', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (isDbEnabled()) {
      try {
        const prisma = getPrisma()!;
        const docs = await prisma.applicationDocument.findMany({ where: { applicationId: id } });
        const events = await prisma.applicationEvent.findMany({ where: { applicationId: id }, orderBy: { createdAt: 'desc' }, take: 10 });
        const prepared = events.find(e => e.eventType === 'DOCUMENTS_PREPARED');
        return { applicationId: id, documents: docs.map(d => ({ ...d, downloadUrl: `/documents/${encodeURIComponent(d.fileKey)}/download` })), preparedData: (prepared?.eventData as any) ?? null, source: 'db' };
      } catch {}
    }
    reply.code(404);
    return { error: 'No documents yet — call POST /jobs/:id/prepare?applicationId=' + id };
  });
}
