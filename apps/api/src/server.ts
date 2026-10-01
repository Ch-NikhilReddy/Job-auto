import Fastify from 'fastify';
import cors from '@fastify/cors';
import { appConfig } from './config/app.js';
import { healthRoutes } from './routes/health.js';
import { profileRoutes } from './routes/profile.js';
import { jobsRoutes } from './routes/jobs.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { applicationRoutes } from './routes/applications.js';
import { automationRoutes } from './routes/automation.js';
import { documentRoutes } from './routes/documents.js';
import { timelineRoutes } from './routes/timeline.js';
import { outreachRoutes } from './routes/outreach.js';

import { startDiscoveryWorker } from './workers/discoveryWorker.js';
import { startAutoApplyWorker } from './workers/autoApplyWorker.js';
import { registerApiKeyAuth } from './config/apiAuth.js';

async function buildServer() {
  const app = Fastify({ logger: appConfig.env !== 'production' });

  await app.register(cors, {
    origin: true,
  });

  // Protect all non-health routes with an API key (PII + auto-apply endpoints)
  registerApiKeyAuth(app);

  // Start background workers in-process (cloud: this service stays alive 24/7)
  startDiscoveryWorker();
  startAutoApplyWorker();

  app.register(async (instance) => {
    await healthRoutes(instance);
    await profileRoutes(instance);
    await jobsRoutes(instance);
    await dashboardRoutes(instance);
    await applicationRoutes(instance);
    await automationRoutes(instance);
    await documentRoutes(instance);
    await timelineRoutes(instance);
    await outreachRoutes(instance);
  });

  return app;
}

const server = await buildServer();

const listenPort = Number(process.env.PORT ?? appConfig.port ?? 4000);

try {
  await server.listen({ port: listenPort, host: '0.0.0.0' });
  console.log(`CareerPilot API listening on http://0.0.0.0:${listenPort} (PORT=${process.env.PORT ?? 'unset'})`);
} catch (error) {
  server.log.error(error);
  process.exit(1);
}
