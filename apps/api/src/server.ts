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

async function buildServer() {
  const app = Fastify({ logger: appConfig.env !== 'production' });

  await app.register(cors, {
    origin: true,
  });

  app.register(async (instance) => {
    await healthRoutes(instance);
    await profileRoutes(instance);
    await jobsRoutes(instance);
    await dashboardRoutes(instance);
    await applicationRoutes(instance);
    await automationRoutes(instance);
    await documentRoutes(instance);
    await timelineRoutes(instance);
  });

  return app;
}

const server = await buildServer();

try {
  await server.listen({ port: appConfig.port, host: '0.0.0.0' });
  console.log(`CareerPilot API listening on http://localhost:${appConfig.port}`);
} catch (error) {
  server.log.error(error);
  process.exit(1);
}
