// Resume Agent per §8 + §23 — truthful tailoring, never adds skill not in profile
import { nikhilProfile } from '../data/profile.js';

export type TailoredResume = {
  summary: string;
  reorderedProjects: { name: string; reason: string; techStack: string[] }[];
  highlightedSkills: string[];
  atsKeywords: string[];
  generatedAt: string;
  source: 'template' | 'ai';
};

const PROJECT_KEYWORDS: Record<string, string[]> = {
  'Smart Hostel': ['react','spring boot','mysql','role-based','jwt','rest apis'],
  'Gas Agency': ['mern','mongodb','express','react','node.js','jwt','email'],
  'Civic Issues Portal': ['react','leaflet','tailwind','node','express','mongodb','geolocation','hackathon'],
  'Student-Teacher': ['mern','scheduling','rest apis','mongodb'],
  'Ecoyaan': ['next.js','react','ssr','checkout','tailwind'],
  'Adaptive Cognitive Firewall': ['python','security','ml','offline','host monitoring'],
  'Custom OS': ['nasm','qemu','systems','os'],
};

export function tailorResumeForJob(job: { title: string; company: string; skills: string[]; description: string }): TailoredResume {
  const jobText = `${job.title} ${job.description} ${job.skills.join(' ')}`.toLowerCase();
  const jobSkillsLower = job.skills.map(s => s.toLowerCase());

  // Score projects by overlap with job skills/text — deterministic, no LLM needed
  const scored = nikhilProfile.projects.map(p => {
    const stack = (p as any).stack ?? (p as any).techStack ?? [];
    const kws = (PROJECT_KEYWORDS[p.name.split(' ')[0]] ?? stack.map((s: string) => s.toLowerCase()));
    const overlap = kws.filter((k: string) => jobText.includes(k.toLowerCase()) || jobSkillsLower.includes(k.toLowerCase())).length;
    const skillOverlap = stack.filter((s: string) => jobSkillsLower.includes(s.toLowerCase()) || jobText.includes(s.toLowerCase())).length;
    return { project: p, score: overlap * 2 + skillOverlap * 3, reason: overlap ? `Matches ${kws.filter((k: string) => jobText.includes(k.toLowerCase())).slice(0,2).join(', ')}` : 'General full-stack relevance' };
  }).sort((a,b) => b.score - a.score);

  const highlightedSkills = nikhilProfile.skills.filter(s => jobSkillsLower.includes(s.toLowerCase()) || jobText.includes(s.toLowerCase()));
  const atsKeywords = [...new Set([...job.skills.filter(s => nikhilProfile.skills.map(x=>x.toLowerCase()).includes(s.toLowerCase())), ...highlightedSkills])].slice(0,12);

  // Summary tailoring — pick relevant stack mention, preserve truthfulness
  const topStackRaw = (scored[0]?.project as any)?.stack ?? (scored[0]?.project as any)?.techStack ?? ['React','Node.js','Spring Boot'];
  const topStack = topStackRaw.slice(0,3).join(', ');
  const summary = `Final-year B.Tech IT (Anurag University, 2027) — ${highlightedSkills.length ? `experienced in ${highlightedSkills.slice(0,4).join(', ')} — ` : ''}built ${scored[0].project.name} (${topStack}) and ${scored.length-1} other full-stack systems. Seeking ${job.title} at ${job.company}. Available immediately for internships, full-time from mid-2027.`;

  return {
    summary,
    reorderedProjects: scored.map(s => ({ name: s.project.name, reason: s.reason, techStack: (s.project as any).stack ?? (s.project as any).techStack ?? [] })),
    highlightedSkills,
    atsKeywords,
    generatedAt: new Date().toISOString(),
    source: 'template',
  };
}
