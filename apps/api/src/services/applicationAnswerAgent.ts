// Application Answer Engine per §7 + §19 — answers ONLY from verified profile, flags UNKNOWN
import { nikhilProfile } from '../data/profile.js';

export type Question = { key: string; text: string; required?: boolean };
export type Answer = { key: string; question: string; answer: string; source: 'PROFILE' | 'JOB_DESCRIPTION' | 'USER_INPUT' | 'UNKNOWN'; confidence: 'high' | 'low'; needsUser: boolean; reason?: string };

const VERIFIED_FACTS: Record<string, string> = {
  fullName: nikhilProfile.fullName,
  education: `${nikhilProfile.education} — ${nikhilProfile.university} (2027)`,
  graduationYear: '2027',
  currentCity: nikhilProfile.currentCity,
  preferredLocations: nikhilProfile.preferredLocations.join(', '),
  availability: nikhilProfile.availability,
  skills: nikhilProfile.skills.slice(0,8).join(', '),
  topProject: nikhilProfile.projects[0].name,
  cgpa: nikhilProfile.constraints.cgpa,
  github: nikhilProfile.github,
  portfolio: nikhilProfile.portfolio,
  internship: 'Unified Mentor — Web Development Intern (Jul–Oct 2025)',
};

// Patterns that MUST be flagged as UNKNOWN per §7 / §19 (never guess)
const UNKNOWN_PATTERNS = [
  /visa.*sponsor/i, /sponsorship/i, /authorized to work/i, /work authorization/i, /eligible to work/i,
  /salary.*expect/i, /expected.*salary/i, /compensation.*expect/i, /ctc.*expect/i, /stipend.*expect/i,
  /how many years.*experience/i, /years of.*experience/i, /professional.*experience/i,
  /relocat/i, /willing.*relocat/i,
  /background.*check/i, /authorization.*check/i,
  /demographic/i, /gender/i, /race/i, /disability/i,
  /captcha/i, /mfa/i, /otp/i,
];

const KNOWN_TEMPLATES: { pattern: RegExp; answer: (q: string, job: { title: string; company: string }) => string }[] = [
  { pattern: /why.*interested|why.*apply|why.*role|motivation/i, answer: (_, job) => `I am drawn to the ${job.title} role at ${job.company} because it aligns with my full-stack experience in ${VERIFIED_FACTS.skills} and my projects like ${VERIFIED_FACTS.topProject}. As a final-year B.Tech IT student (2027) available immediately for internships, I want to learn from your team while contributing production-ready features.` },
  { pattern: /tell.*about.*yourself|introduce/i, answer: () => `I am ${VERIFIED_FACTS.fullName}, ${VERIFIED_FACTS.education} in ${VERIFIED_FACTS.currentCity}. I built 5+ full-stack apps (React/Next.js, Node/Express, Spring Boot, MongoDB/MySQL) and my Civic Portal won MLRIT Hackathon. ${VERIFIED_FACTS.internship}. Portfolio: ${VERIFIED_FACTS.portfolio}` },
  { pattern: /strength|skill/i, answer: () => `My strengths are ${VERIFIED_FACTS.skills}. I own features end-to-end from DB modeling to deployment (Vercel/Render) and have experience with JWT auth and role-based access.` },
  { pattern: /project.*proud|describe.*project/i, answer: () => `My Smart Hostel Complaint System (React + Spring Boot + MySQL) with role-based complaint lifecycle and my Civic Issues Portal (React + Leaflet + Node/Express/MongoDB, Hackathon Winner) best demonstrate my full-stack execution.` },
  { pattern: /available|join.*date|notice.*period/i, answer: () => VERIFIED_FACTS.availability },
  { pattern: /location|where.*based|current.*city/i, answer: () => VERIFIED_FACTS.currentCity },
  { pattern: /education|degree|university|graduation/i, answer: () => `${VERIFIED_FACTS.education}, Graduation 2027, CGPA ${VERIFIED_FACTS.cgpa}` },
  { pattern: /github|portfolio|link/i, answer: () => `${VERIFIED_FACTS.github} | ${VERIFIED_FACTS.portfolio}` },
];

export function answerQuestion(job: { title: string; company: string; description: string }, q: Question): Answer {
  const text = q.text;

  // 1. UNKNOWN gate — per §19 never guess
  for (const pat of UNKNOWN_PATTERNS) {
    if (pat.test(text)) {
      return { key: q.key, question: text, answer: '', source: 'UNKNOWN', confidence: 'low', needsUser: true, reason: `Matches UNKNOWN pattern ${pat} — requires user confirmation per §19` };
    }
  }

  // 2. Known template
  for (const tmpl of KNOWN_TEMPLATES) {
    if (tmpl.pattern.test(text)) {
      return { key: q.key, question: text, answer: tmpl.answer(text, job), source: 'PROFILE', confidence: 'high', needsUser: false };
    }
  }

  // 3. Fallback — flag for user review (never fabricate per §35)
  return { key: q.key, question: text, answer: '', source: 'UNKNOWN', confidence: 'low', needsUser: true, reason: 'No verified fact traces to this question — FLAG FOR USER (do not guess)' };
}

export function answerQuestions(job: { title: string; company: string; description: string }, questions: Question[]): Answer[] {
  return questions.map(q => answerQuestion(job, q));
}

// Default questions to pre-fill for any application (used if ATS provides none)
export const DEFAULT_QUESTIONS: Question[] = [
  { key: 'why_interested', text: 'Why are you interested in this role?', required: true },
  { key: 'available_date', text: 'When are you available to start?', required: false },
];
