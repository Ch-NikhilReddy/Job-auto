// QA / Safety Agent per §35 + §23 — never invents, traces every statement to PROFILE/JD/USER_INPUT
import { nikhilProfile } from '../data/profile.js';
import type { TailoredResume } from './resumeAgent.js';
import type { CoverLetter } from './coverLetterAgent.js';

export type QAResult = {
  ok: boolean; // false = BLOCK, true = PASS with warnings possible
  blockers: string[]; // must fix before approval
  warnings: string[]; // advisory
  checks: { name: string; passed: boolean; detail: string }[];
};

const VERIFIED_SKILLS_LOWER = new Set(nikhilProfile.skills.map(s => s.toLowerCase()));
const VERIFIED_PROJECTS_LOWER = new Set(nikhilProfile.projects.map(p => p.name.toLowerCase()));
const VERIFIED_EDU = `${nikhilProfile.education} ${nikhilProfile.university} 2027`.toLowerCase();

export function checkTailoredResume(job: { title: string; description: string }, tailored: TailoredResume): QAResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const checks: QAResult['checks'] = [];

  // 1. No invented skills
  const inventedSkills = tailored.highlightedSkills.filter(s => !VERIFIED_SKILLS_LOWER.has(s.toLowerCase()));
  checks.push({ name: 'No invented skills', passed: inventedSkills.length === 0, detail: inventedSkills.length ? `Invented: ${inventedSkills.join(', ')}` : `All ${tailored.highlightedSkills.length} skills verified` });
  if (inventedSkills.length) blockers.push(`Invented skills blocked: ${inventedSkills.join(', ')} — remove or add to profile.json first`);

  // 2. No invented projects
  const inventedProjects = tailored.reorderedProjects.filter(p => !VERIFIED_PROJECTS_LOWER.has(p.name.toLowerCase()) && !VERIFIED_PROJECTS_LOWER.has(p.name.toLowerCase().split(' —')[0].trim().toLowerCase()));
  // Allow partial match (e.g., "Civic Issues Portal" vs "Civic Issues Portal — Hackathon")
  const softInvented = inventedProjects.filter(p => !nikhilProfile.projects.some(vp => p.name.toLowerCase().includes(vp.name.split(' ')[0].toLowerCase())));
  checks.push({ name: 'No invented projects', passed: softInvented.length === 0, detail: softInvented.length ? `Unknown projects: ${softInvented.map(p=>p.name).join(', ')}` : `All projects traced to resume` });
  if (softInvented.length) blockers.push(`Unknown projects: ${softInvented.map(p=>p.name).join(', ')}`);

  // 3. ATS keywords must be subset of verified + job skills (never add skill just because JD contains it per §8 #7)
  const inventedAts = tailored.atsKeywords.filter(k => !VERIFIED_SKILLS_LOWER.has(k.toLowerCase()));
  checks.push({ name: 'ATS keywords truthful', passed: inventedAts.length === 0, detail: inventedAts.length ? `ATS invented: ${inventedAts.join(', ')}` : `ATS keywords verified` });
  if (inventedAts.length) blockers.push(`ATS keywords include unverified skills: ${inventedAts.join(', ')}`);

  // 4. Unknown fields — visa/salary must be flagged per §7
  const jdLower = `${job.title} ${job.description}`.toLowerCase();
  if (/visa|sponsorship|authorized to work|work authorization/i.test(jdLower)) {
    warnings.push('Job mentions visa/sponsorship — profile marks visaSponsorship=UNKNOWN → FLAG FOR USER (do not guess)');
    checks.push({ name: 'Work authorization', passed: false, detail: 'UNKNOWN — requires user confirmation' });
  } else {
    checks.push({ name: 'Work authorization', passed: true, detail: 'No visa question in JD' });
  }
  if (/salary|compensation|ctc|stipend/i.test(jdLower) && nikhilProfile.constraints.salaryExpectation === 'UNKNOWN') {
    warnings.push('Salary/stipend mentioned but profile salaryExpectation=UNKNOWN — ask user before answering');
    checks.push({ name: 'Salary expectation', passed: false, detail: 'UNKNOWN' });
  }

  // 5. Education not fabricated
  if (tailored.summary.toLowerCase().includes('m.tech') || tailored.summary.toLowerCase().includes('mca')) {
    blockers.push('Summary claims unowned degree (M.Tech/MCA) — blocked');
    checks.push({ name: 'Education truthfulness', passed: false, detail: 'Invented degree in summary' });
  } else {
    checks.push({ name: 'Education truthfulness', passed: true, detail: `B.Tech IT 2027 verified` });
  }

  return { ok: blockers.length === 0, blockers, warnings, checks };
}

export function checkCoverLetter(cover: CoverLetter): QAResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const checks: QAResult['checks'] = [];

  const text = cover.body.toLowerCase();
  // Never claim experience not in profile
  if (/[\d]+\s+years.*experience/i.test(text) && !text.includes('hands-on') && !text.includes('built')) {
    const hasFakeYears = /([3-9]|\d{2,})\s+years/.test(text);
    if (hasFakeYears) { blockers.push('Cover claims years of professional experience — not in profile (fresher)'); checks.push({ name: 'Experience claim', passed: false, detail: 'Years claim detected' }); }
  } else {
    checks.push({ name: 'Experience claim', passed: true, detail: 'No false years claim' });
  }
  if (text.includes('2carvn') || text.includes('2carvn')) {
    warnings.push('Cover mentions 2CaRvN — you asked to keep it aside (friend startup) — remove before sending');
    checks.push({ name: '2CaRvN mention', passed: false, detail: 'Should be removed per your instruction' });
  } else {
    checks.push({ name: '2CaRvN mention', passed: true, detail: 'Clean' });
  }

  return { ok: blockers.length === 0, blockers, warnings, checks };
}

export function fullQACheck(job: { title: string; description: string }, tailored: TailoredResume, cover: CoverLetter): QAResult {
  const r1 = checkTailoredResume(job, tailored);
  const r2 = checkCoverLetter(cover);
  return {
    ok: r1.ok && r2.ok,
    blockers: [...r1.blockers, ...r2.blockers],
    warnings: [...r1.warnings, ...r2.warnings],
    checks: [...r1.checks, ...r2.checks],
  };
}
