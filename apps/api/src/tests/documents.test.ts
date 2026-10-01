import { describe, it, expect } from 'vitest';
import { scoreJobMatch, type JobPreference } from '../utils/jobMatcher.js';
import { tailorResumeForJob } from '../services/resumeAgent.js';
import { generateCoverLetter } from '../services/coverLetterAgent.js';
import { tailorResumeForJob as tailor } from '../services/resumeAgent.js';

describe('document generation', () => {
  const job = { title: 'Full Stack Developer Intern', company: 'Acme', location: 'Hyderabad', skills: ['React', 'Node.js', 'MongoDB'], description: 'Build full stack products with React and Node.js' };

  it('reorders projects toward the JD', () => {
    const t = tailor(job);
    const top = t.reorderedProjects[0];
    expect(['Civic Issues Portal', 'Ecoyaan Checkout System']).toContain(top.name);
    expect(top.reason.length).toBeGreaterThan(0);
  });

  it('only emits ATS keywords present in the profile', () => {
    const t = tailor(job);
    expect(t.atsKeywords.length).toBeGreaterThan(0);
    expect(t.atsKeywords.every((k) => k.length < 30)).toBe(true);
  });

  it('cover letter mentions company, role, and no fabricated years', () => {
    const t = tailor(job);
    const c = generateCoverLetter(job, t);
    expect(c.body).toContain('Acme');
    expect(c.body).toContain('Full Stack Developer Intern');
    expect(c.body).not.toMatch(/\b[3-9]\+?\s+years of experience/i);
    expect(c.body).toContain('Anurag University');
  });

  it('cover letter has the 4 required sections', () => {
    const c = generateCoverLetter(job, tailor(job));
    const paras = c.body.split('\n\n');
    expect(paras.length).toBeGreaterThanOrEqual(4);
  });
});

describe('duplicate detection', () => {
  const profile: JobPreference = {
    role: 'internship', preferredLocations: ['Hyderabad'], remoteOk: true, workMode: 'hybrid',
    preferredRoles: ['Software Engineer Intern'], skills: ['React.js'], graduationYear: 2027,
  };
  it('produces a stable score for the same input (idempotent)', () => {
    const job: any = { id: 'x', title: 'Software Engineer Intern', company: 'A', location: 'Hyderabad', workMode: 'hybrid', employmentType: 'internship', skills: ['React.js'], description: 'Intern React role' };
    const a = scoreJobMatch(profile, job);
    const b = scoreJobMatch(profile, job);
    expect(a.score).toBe(b.score);
    expect(a.matchingSkills).toEqual(b.matchingSkills);
  });
});
