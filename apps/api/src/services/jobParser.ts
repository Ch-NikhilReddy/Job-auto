// Job Parser — extracts structured signals from raw job description per §4/§5
// Deterministic, no AI required for Phase 3 (cheap filtering before LLM)

export type ParsedJob = {
  requiredSkills: string[];
  preferredSkills: string[];
  experienceYears?: number; // max years required, undefined if not stated
  educationRequirement?: string;
  isFresherEligible: boolean;
  isInternship: boolean;
  mentions: { salary?: string; stipend?: string; deadline?: string };
};

const KNOWN_SKILLS = [
  'react','next.js','javascript','typescript','html','css','tailwind','bootstrap',
  'node.js','express','spring boot','java','python','sql','mysql','mongodb','postgresql',
  'rest apis','jwt','git','github','postman','vercel','docker','aws','azure',
  'leaflet','zustand','axios','redux','prisma','fastify','bullmq','redis',
];

const EDUCATION_KEYWORDS = ['b.tech','b.e','bca','mca','m.tech','bachelor','degree','graduation','2027','fresher','intern'];

export function parseJobDescription(title: string, description: string, employmentType: string): ParsedJob {
  const text = `${title} ${description}`.toLowerCase();
  const requiredSkills = KNOWN_SKILLS.filter(k => text.includes(k));
  const experienceMatch = text.match(/(\d+)\s*\+?\s*(years?|yrs?)\s*(experience|exp)/i) || text.match(/(fresher|0\s*-\s*1\s*year|0-1\s*years)/i);
  let experienceYears: number | undefined;
  if (experienceMatch) {
    const num = parseInt(experienceMatch[1] ?? '0', 10);
    if (!isNaN(num)) experienceYears = num;
    else if (/fresher|0\s*-/.test(experienceMatch[0])) experienceYears = 0;
  }
  const isFresherEligible = /fresher|intern|0\s*-\s*1|0-1|no experience|entry.level|graduate|2027/i.test(text);
  const isInternship = employmentType === 'internship' || /internship|intern/i.test(title);
  const educationRequirement = EDUCATION_KEYWORDS.find(k => text.includes(k));
  return {
    requiredSkills,
    preferredSkills: [],
    experienceYears,
    educationRequirement,
    isFresherEligible: isFresherEligible || experienceYears === 0 || experienceYears === undefined,
    isInternship,
    mentions: {},
  };
}
