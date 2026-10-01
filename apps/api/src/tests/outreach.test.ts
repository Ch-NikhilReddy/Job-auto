import { describe, it, expect } from 'vitest';
import { buildOutreach, allOutreachTemplates, draftEmailsForJobs } from '../services/outreach.js';

describe('outreach — §7 truthful messaging', () => {
  it('provides all four templates', () => {
    expect(allOutreachTemplates()).toHaveLength(4);
  });

  it('uses only real profile facts', () => {
    for (const t of allOutreachTemplates()) {
      expect(t.body).toMatch(/Nikhil Reddy Chittepu/);
      expect(t.body).toMatch(/2027/);
      expect(t.body).toMatch(/github\.com\/Ch-NikhilReddy/);
    }
  });

  it('never fabricates years of experience', () => {
    for (const t of allOutreachTemplates()) {
      expect(t.body).not.toMatch(/\b[3-9]\+?\s+years of (professional )?experience/i);
    }
  });

  it('never claims 2CaRvN', () => {
    for (const t of allOutreachTemplates()) {
      expect(t.body.toLowerCase()).not.toContain('2carvn');
    }
  });

  it('uses placeholders rather than invented names', () => {
    const t = buildOutreach('recruiter');
    expect(t.body).toContain('{Recruiter Name}');
    expect(t.body).toContain('{company}');
  });

  it('every template ships a send checklist', () => {
    for (const t of allOutreachTemplates()) {
      expect(t.checklist.length).toBeGreaterThan(0);
    }
  });

  it('drafts one email per high-scoring job and substitutes the job', () => {
    const drafts = draftEmailsForJobs([
      { title: 'Software Engineer Intern', company: 'Acme', score: 82 },
      { title: 'Low scorer', company: 'X', score: 20 },
    ]);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].body).toContain('Acme');
    expect(drafts[0].body).toContain('Software Engineer Intern');
    expect(drafts[0].body).not.toContain('{company}');
  });
});
