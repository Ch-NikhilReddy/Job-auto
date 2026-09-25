import { parseJobDescription } from '../services/jobParser.js';

export type JobPreference = {
  role?: string;
  preferredLocations: string[];
  remoteOk: boolean;
  workMode?: 'remote' | 'hybrid' | 'onsite';
  preferredRoles: string[];
  skills: string[];
  graduationYear?: number; // e.g., 2027
  education?: string; // e.g., B.Tech IT
};

export type JobListing = {
  id: string;
  title: string;
  company: string;
  location: string;
  workMode: 'remote' | 'hybrid' | 'onsite';
  employmentType: 'internship' | 'full-time' | 'part-time' | 'contract';
  skills: string[];
  description: string;
  salary?: { min?: number; max?: number; currency?: string };
};

export type MatchResult = {
  score: number;
  matchingSkills: string[];
  missingSkills: string[];
  hardBlockers: string[];
  reasoning: string[];
  recommendedAction: string;
  // Transparent breakdown per §5 — store individual reasons, not just score
  breakdown: {
    skills: { matching: string[]; missing: string[]; score: number };
    education: { eligible: boolean; reason: string };
    experience: { eligible: boolean; requiredYears?: number; reason: string };
    location: { compatible: boolean; reason: string };
    role: { relevant: boolean; reason: string };
    graduation: { eligible: boolean; reason: string };
  };
  parsed: ReturnType<typeof parseJobDescription>;
};

export function scoreJobMatch(userProfile: JobPreference, job: JobListing): MatchResult {
  const userSkillSet = userProfile.skills.map((skill) => skill.toLowerCase());
  const jobSkills = job.skills.map((skill) => skill.toLowerCase());
  const matchingSkills = [...new Set(jobSkills.filter((skill) => userSkillSet.includes(skill)))];
  const missingSkills = [...new Set(jobSkills.filter((skill) => !userSkillSet.includes(skill)))];

  const parsed = parseJobDescription(job.title, job.description, job.employmentType);

  // Also consider skills mentioned in description via parser
  const parsedSkillsLower = parsed.requiredSkills.map(s => s.toLowerCase());
  const extraMatching = parsedSkillsLower.filter(s => userSkillSet.includes(s) && !matchingSkills.includes(s));
  const allMatching = [...new Set([...matchingSkills, ...extraMatching])];
  const allMissing = [...new Set([...missingSkills, ...parsedSkillsLower.filter(s => !userSkillSet.includes(s))])];

  const roleRelevant = userProfile.preferredRoles.some((role) => job.title.toLowerCase().includes(role.toLowerCase()));
  const roleMatch = roleRelevant ? 0.25 : 0.1;
  const skillAlignment = jobSkills.length > 0 ? allMatching.length / Math.max(jobSkills.length, parsed.requiredSkills.length || jobSkills.length) : 0.5;
  const locationCompatible = userProfile.preferredLocations.some((location) =>
    job.location.toLowerCase().includes(location.toLowerCase())
  ) || (userProfile.remoteOk && job.workMode === 'remote');
  const locationFit = locationCompatible ? 1 : 0.45;
  const workModeFit = userProfile.workMode === job.workMode || userProfile.remoteOk && job.workMode === 'remote' ? 1 : 0.6;

  // Education: B.Tech IT matches most fresher/intern roles
  const educationEligible = parsed.educationRequirement ? /b\.tech|bachelor|degree|fresher|intern|2027/i.test(parsed.educationRequirement) || !!parsed.isFresherEligible : true;
  // Experience: fresher eligible if 0-1 year or not stated
  const expEligible = parsed.experienceYears === undefined || parsed.experienceYears <= 1;
  // Graduation: 2027 eligible for intern/fresher
  const gradEligible = !userProfile.graduationYear || parsed.isFresherEligible || parsed.isInternship;

  const score = Math.round((roleMatch * 25 + Math.min(skillAlignment,1) * 30 + locationFit * 15 + workModeFit * 10 + (educationEligible ? 10 : 0) + (expEligible ? 10 : 0)) * 100) / 100;

  const hardBlockers: string[] = [];
  if (job.employmentType === 'full-time' && userProfile.role === 'internship' && !parsed.isFresherEligible) {
    hardBlockers.push('Full-time role requires >1 year experience — not fresher-eligible.');
  }
  if (parsed.experienceYears !== undefined && parsed.experienceYears > 1) {
    hardBlockers.push(`Requires ${parsed.experienceYears}+ years — exceeds fresher threshold (max 1 year).`);
  }
  if (!locationCompatible && !userProfile.remoteOk && job.workMode !== 'remote') {
    hardBlockers.push(`Location ${job.location} not in preferred: ${userProfile.preferredLocations.join(', ')}`);
  }

  const reasoning = [
    `Role relevance: ${roleRelevant ? 'relevant' : 'limited'} — "${job.title}" vs preferred ${userProfile.preferredRoles.slice(0,3).join(', ')}`,
    `Skills: ${allMatching.length} matching / ${allMissing.length} missing (job lists ${jobSkills.length}, parsed ${parsed.requiredSkills.length})`,
    `Education: ${educationEligible ? 'eligible (B.Tech IT 2027)' : 'check required: ' + (parsed.educationRequirement ?? 'unknown')}`,
    `Experience: ${expEligible ? 'fresher-eligible' : `needs ${parsed.experienceYears} years` }`,
    `Location: ${locationCompatible ? 'compatible' : 'partial'} (${job.location}, ${job.workMode}${userProfile.remoteOk ? ', remote OK' : ''})`,
  ];

  return {
    score: Math.min(Math.round(score), 100),
    matchingSkills: allMatching,
    missingSkills: allMissing,
    hardBlockers,
    reasoning,
    recommendedAction:
      hardBlockers.length > 0
        ? `Blocked: ${hardBlockers[0]} — skip or review eligibility.`
        : allMissing.length > 2
          ? 'Partial match — tailor resume to highlight overlapping skills and address gaps.'
          : 'Strong match — prepare tailored application and submit with approval.',
    breakdown: {
      skills: { matching: allMatching, missing: allMissing, score: Math.round(skillAlignment * 100) },
      education: { eligible: educationEligible, reason: educationEligible ? 'B.Tech IT eligible for fresher/intern roles' : `Requires ${parsed.educationRequirement}` },
      experience: { eligible: expEligible, requiredYears: parsed.experienceYears, reason: expEligible ? 'Fresher/0-1 year eligible' : `Requires ${parsed.experienceYears}+ years` },
      location: { compatible: locationCompatible, reason: locationCompatible ? `Matches Hyderabad/Remote/Bengaluru` : `Prefers ${userProfile.preferredLocations.join(', ')}` },
      role: { relevant: roleRelevant, reason: roleRelevant ? `Title contains preferred role` : `Title does not contain ${userProfile.preferredRoles[0]}` },
      graduation: { eligible: gradEligible, reason: gradEligible ? '2027 graduation eligible for intern/fresher' : 'Graduation mismatch' },
    },
    parsed,
  };
}
