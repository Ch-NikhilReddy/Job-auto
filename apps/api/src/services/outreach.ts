// Referral outreach generator — §7 truthfulness.
// Produces ready-to-send messages grounded ONLY in verified profile facts
// (no fabricated connections, no invented referrals, no fake relationships).

import { nikhilProfile } from '../data/profile.js';

export type OutreachKind = 'alumni' | 'recruiter' | 'referral' | 'cold_dm';
export type OutreachMessage = { kind: OutreachKind; channel: string; body: string; checklist: string[] };

const facts = {
  role: 'Full-Stack / Software Engineer Intern',
  grad: 'B.Tech IT, Anurag University — graduating 2027',
  stack: 'React, Next.js, Node.js, Express, Spring Boot, MongoDB, MySQL',
  win: 'Civic Issues Portal — won the MLRIT Hackathon; Smart Hostel system (React + Spring Boot + MySQL) with role-based access',
  ai: 'Adaptive Cognitive Firewall — an offline-first host security project (local rule engine + ML classifier)',
  available: 'Available immediately for a 6-month internship; full-time from mid-2027',
  github: nikhilProfile.github,
  portfolio: nikhilProfile.portfolio,
};

const HEAD = `Hi ${'{name}'}, I'm Nikhil Reddy Chittepu — ${facts.grad}. I'm currently looking for a ${facts.role} role${'{ , and I saw that you work at ' + '{company}' + ' — hoping you might have 2 minutes.'}}`;

export function buildOutreach(kind: OutreachKind): OutreachMessage {
  switch (kind) {
    case 'alumni':
      return {
        kind, channel: 'LinkedIn',
        body: `${HEAD}

I built ${facts.win}. My work is on GitHub (${facts.github}) and my portfolio is ${facts.portfolio}.

Would you be open to a quick 10-minute chat about how the team at ${'{company}'} approaches backend work? I'm ${facts.available} and open to ${'{ Hyderabad / remote / any location you recommend}'}.

Either way, thank you for reading.`,
        checklist: [
          'Search Anurag alumni on LinkedIn — filter by Company',
          'Only message people you actually share a school/branch connection with',
          'Personalise the first line with something specific from their profile',
          'Never claim a referral exists — ask if they would be comfortable referring you',
        ],
      };

    case 'recruiter':
      return {
        kind, channel: 'Email / LinkedIn',
        body: `Subject: B.Tech IT 2027 applicant — ${'{company}'} ${'{role}'}

${'{Recruiter Name}'}, I'm Nikhil Reddy Chittepu, a final-year B.Tech IT student at Anurag University, Hyderabad (2027).

I'm applying for the ${'{role}'} position and wanted to reach out directly. I work primarily in ${facts.stack}, and I'm comfortable owning features end to end — schema, API, UI, and deployment. Two things I'm proud of: ${facts.win}. I also built ${facts.ai}.

I'm ${facts.available}, based in Hyderabad and open to relocation. Resume and projects: ${facts.portfolio} | ${facts.github}

If the role is still open, I'd welcome a chat. Happy to share a tailored resume for ${'{company}'} immediately.

Best regards,
Nikhil Reddy Chittepu
+91 7995214340`,
        checklist: [
          'Replace {name} / {company} / {role} placeholders',
          'Attach the tailored DOCX generated in the dashboard — not the generic one',
          'Keep it under 150 words in the first paragraph',
          'Follow up once after 5–7 days, then stop',
        ],
      };

    case 'referral':
      return {
        kind, channel: 'LinkedIn',
        body: `Hi ${'{name}'}, hope you're well. I'm Nikhil Reddy Chittepu, ${facts.grad}.

I'm applying to ${'{company}'} for ${'{role}'}. I saw that ${'{name}'} is/hired from there — if you're comfortable referring me, I'd be grateful. If not, no problem at all.

Quick context so it's easy to judge: I work in ${facts.stack}, and my ${facts.win}. Portfolio ${facts.portfolio}, GitHub ${facts.github}.

If a referral isn't appropriate, a pointer to the right team or hiring manager would still help. Thanks either way.`,
        checklist: [
          'Only ask someone who is actually connected to the company',
          'Give them an easy out — "if not, no problem"',
          'Attach the job link you are applying to',
          'If they refer you, thank them with a short update after 1 week',
        ],
      };

    case 'cold_dm':
    default:
      return {
        kind: 'cold_dm', channel: 'LinkedIn / Twitter',
        body: `Hi ${'{name}'} — quick one.

I'm Nikhil Reddy Chittepu, ${facts.grad}, building full-stack things in ${facts.stack}.

What I'm working on: ${facts.win}, plus ${facts.ai}.

I'm looking for a ${facts.role} role and I'm ${facts.available}. If your team at ${'{company}'} ever needs an intern who ships end-to-end, I'd love to talk.

GitHub: ${facts.github}`,
        checklist: [
          'Keep it under 90 words — cold DMs get skimmed',
          'Lead with a concrete thing you built, not a request',
          'One clear ask, no follow-up spam',
        ],
      };
  }
}

export function allOutreachTemplates(): OutreachMessage[] {
  return [buildOutreach('alumni'), buildOutreach('recruiter'), buildOutreach('referral'), buildOutreach('cold_dm')];
}

/** Finds high-score saved jobs and drafts a matching recruiter email for each. */
export function draftEmailsForJobs(jobs: { title: string; company: string; score: number }[]): OutreachMessage[] {
  return jobs
    .filter((j) => j.score >= 60)
    .slice(0, 10)
    .map((j) => {
      const base = buildOutreach('recruiter');
      return {
        ...base,
        body: base.body
          .replaceAll('{role}', j.title)
          .replaceAll('{company}', j.company)
          .replaceAll('{Recruiter Name}', 'Hiring Team'),
      };
    });
}
