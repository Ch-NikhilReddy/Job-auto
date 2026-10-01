// API-key auth guard. Single-user system, but the API holds PII (email, phone,
// resumes, application answers) and can trigger auto-apply — it must not be public.
// If API_KEY is unset the guard is a no-op so local dev still works.

import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    apiKeyOk?: boolean;
  }
}

function extractKey(req: FastifyRequest): string | undefined {
  const h = req.headers['x-api-key'];
  if (typeof h === 'string' && h.length) return h;
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return undefined;
}

// Paths that must stay reachable without a key (health checks, uptime monitors)
const PUBLIC = new Set(['/health', '/health/detailed', '/', '/favicon.ico']);

export function registerApiKeyAuth(app: FastifyInstance) {
  const key = (process.env.API_KEY ?? '').trim();

  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      app.log.warn('[auth] API_KEY is not set — API is OPEN. Set API_KEY in production.');
    }
    app.log.warn('[auth] API_KEY not set — auth disabled (dev mode)');
    return;
  }

  app.log.info('[auth] API key protection enabled');
  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    const path = (req.url ?? '').split('?')[0];
    if (PUBLIC.has(path)) return;

    const provided = extractKey(req);
    if (!provided || provided !== key) {
      app.log.warn(`[auth] rejected ${req.method} ${path}`);
      reply.code(401);
      return reply.send({ error: 'Unauthorized', hint: 'Send header X-API-Key: <API_KEY>' });
    }
    req.apiKeyOk = true;
  });
}
