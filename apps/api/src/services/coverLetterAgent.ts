// Cover Letter Agent per §9 — concise, company + JD aware, never fabricates
import { nikhilProfile } from '../data/profile.js';
import type { TailoredResume } from './resumeAgent.js';

export type CoverLetter = {
  subject: string;
  body: string; // 4-paragraph structure: Opening / Relevant skills / Relevant project / Why this role + Closing
  generatedAt: string;
  source: 'template' | 'ai';
};

export function generateCoverLetter(job: { title: string; company: string; location: string; description: string }, tailored: TailoredResume): CoverLetter {
  const topProject = tailored.reorderedProjects[0]?.name ?? nikhilProfile.projects[0].name;
  const topSkills = tailored.highlightedSkills.slice(0,3).join(', ') || 'React, Node.js, Spring Boot';

  const subject = `Application for ${job.title} — ${nikhilProfile.fullName} (B.Tech IT 2027, ${job.location})`;

  const body = `Dear Hiring Manager at ${job.company},

I am a final-year B.Tech Information Technology student at Anurag University, Hyderabad (expected graduation 2027), writing to apply for the ${job.title} role in ${job.location}. With hands-on experience in ${topSkills} and a portfolio of 5+ deployed full-stack applications, I am available immediately for a 6-month internship and for full-time roles from mid-2027.

My work aligns with your stack: I built ${topProject} and ${tailored.reorderedProjects.slice(1,3).map(p=>p.name).join(' and ')} using ${tailored.highlightedSkills.slice(0,4).join(', ') || 'React, Next.js, Node.js'}. My Civic Issues Portal (Leaflet + Node/Express/MongoDB) won the MLRIT Hackathon, and my Smart Hostel system (React + Spring Boot + MySQL) demonstrates role-based access and JWT auth at scale. My mini project, Adaptive Cognitive Firewall, reflects systems thinking beyond CRUD.

I am drawn to ${job.company} because your ${job.description.slice(0,120)} aligns with my interest in building reliable, user-focused products. I would value learning from your team while contributing fast execution, ownership, and a production mindset (Vercel/Render deployments, Git workflows from my Unified Mentor internship).

My portfolio is at ${nikhilProfile.portfolio} and GitHub at ${nikhilProfile.github}. I have tailored my resume to highlight ${tailored.atsKeywords.slice(0,4).join(', ')} for this role and welcome an interview at your convenience. Thank you for considering my application.

Sincerely,
${nikhilProfile.fullName}
${nikhilProfile.currentCity} | ${nikhilProfile.github} | ${nikhilProfile.portfolio}`;

  return { subject, body, generatedAt: new Date().toISOString(), source: 'template' };
}
