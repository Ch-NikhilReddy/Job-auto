import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const profileSchema = z.object({
  fullName: z.string().min(1),
  education: z.string().min(1),
  currentCity: z.string().min(1),
  preferredLocations: z.array(z.string()).default([]),
  preferredRoles: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  remoteOk: z.boolean().default(true),
  workMode: z.enum(['remote', 'hybrid', 'onsite']).default('hybrid'),
});

import { nikhilProfile } from '../data/profile.js';

export async function profileRoutes(app: FastifyInstance) {
  app.get('/profile', async () => ({
    profile: {
      fullName: nikhilProfile.fullName,
      education: `${nikhilProfile.education} — ${nikhilProfile.university} (Expected 2027)`,
      currentCity: nikhilProfile.currentCity,
      preferredLocations: nikhilProfile.preferredLocations,
      preferredRoles: nikhilProfile.preferredRoles,
      skills: nikhilProfile.skills,
      remoteOk: true,
      workMode: 'hybrid',
      portfolio: nikhilProfile.portfolio,
      github: nikhilProfile.github,
      linkedin: nikhilProfile.linkedin,
    },
  }));

  app.post('/profile', async (request, reply) => {
    const parsed = profileSchema.safeParse(request.body);

    if (!parsed.success) {
      reply.code(400);
      return { error: 'Invalid profile payload', details: parsed.error.flatten() };
    }

    return {
      ok: true,
      profile: parsed.data,
    };
  });
}
