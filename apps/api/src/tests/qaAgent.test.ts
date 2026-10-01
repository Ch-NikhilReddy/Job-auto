import { describe, it, expect } from 'vitest';
import { checkTailoredResume, checkCoverLetter, fullQACheck } from '../services/qaAgent.js';
import { tailorResumeForJob } from '../services/resumeAgent.js';
import { generateCoverLetter } from '../services/coverLetterAgent.js';
import { nikhilProfile } from '../data/profile.js';

const job = { title: 'Software Engineer Intern', company: 'Acme', location: 'Hyderabad', description: 'Build React and Node.js services', skills: ['React', 'Node.js'] };

describe('qaAgent — §35 fabrication guards', () => {
  it('passes a truthful tailored resume', () => {
    const tailored = tailorResumeForJob(job);
    const r = checkTailoredResume(job, tailored);
    expect(r.blockers).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it('BLOCKS invented skills', () => {
    const tailored = tailorResumeForJob(job);
    tailored.highlightedSkills = [...tailored.highlightedSkills, 'Kubernetes', 'Rust'];
    const r = checkTailoredResume(job, tailored);
    expect(r.ok).toBe(false);
    expect(r.blockers.join(' ')).toMatch(/invented skills/i);
  });

  it('BLOCKS invented projects', () => {
    const tailored = tailorResumeForJob(job);
    tailored.reorderedProjects.unshift({ name: 'Netflix Clone', reason: 'x', techStack: ['React'] });
    const r = checkTailoredResume(job, tailored);
    expect(r.ok).toBe(false);
  });

  it('BLOCKS a fabricated degree in the summary', () => {
    const tailored = tailorResumeForJob(job);
    tailored.summary = 'M.Tech holder with M.Sc research experience';
    const r = checkTailoredResume(job, tailored);
    expect(r.ok).toBe(false);
  });

  it('WARNS (not blocks) on visa questions — needs user input', () => {
    const tailored = tailorResumeForJob(job);
    const r = checkTailoredResume({ title: 'Role', description: 'Applicants must require visa sponsorship' }, tailored);
    expect(r.warnings.join(' ')).toMatch(/visa/i);
    expect(r.blockers).toHaveLength(0);
  });

  it('flags 2CaRvN as unwanted in a cover letter', () => {
    const cover = { subject: 's', body: 'I worked at 2CaRvN as technical head.', generatedAt: '', source: 'template' as const };
    const r = checkCoverLetter(cover);
    expect(r.warnings.join(' ')).toMatch(/2carvn/i);
  });

  it('fullQACheck combines both', () => {
    const tailored = tailorResumeForJob(job);
    const cover = generateCoverLetter(job, tailored);
    const r = fullQACheck(job, tailored, cover);
    expect(r.checks.length).toBeGreaterThan(4);
  });
});

describe('profile integrity', () => {
  it('only lists skills that exist in the profile', () => {
    const tailored = tailorResumeForJob(job);
    for (const s of tailored.highlightedSkills) {
      expect(nikhilProfile.skills.map((x) => x.toLowerCase())).toContain(s.toLowerCase());
    }
  });

  it('every project is traceable to the profile', () => {
    const tailored = tailorResumeForJob(job);
    expect(tailored.reorderedProjects.length).toBe(nikhilProfile.projects.length);
  });

  it('marks visa/salary as UNKNOWN rather than guessing', () => {
    expect(nikhilProfile.constraints.visaSponsorship).toBe('UNKNOWN');
    expect(nikhilProfile.constraints.salaryExpectation).toBe('UNKNOWN');
  });
});
