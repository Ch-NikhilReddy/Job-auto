import 'dotenv/config';
import { Queue, QueueEvents, JobsOptions } from 'bullmq';
import { Redis } from 'ioredis';

let connection: Redis | null = null;
let discoveryQueue: Queue | null = null;
let queueEvents: QueueEvents | null = null;

function getRedisConnection(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (connection) return connection;
  connection = new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: false });
  connection.on('error', (err: Error) => console.warn('[Queue] Redis error (fallback to inline):', err.message));
  return connection;
}

export function getDiscoveryQueue(): Queue | null {
  const redis = getRedisConnection();
  if (!redis) return null;
  if (discoveryQueue) return discoveryQueue;
  discoveryQueue = new Queue('discovery', { connection: redis });
  return discoveryQueue;
}

export function getQueueEvents(): QueueEvents | null {
  const redis = getRedisConnection();
  if (!redis) return null;
  if (queueEvents) return queueEvents;
  queueEvents = new QueueEvents('discovery', { connection: redis });
  return queueEvents;
}

export const DEFAULT_JOB_OPTS: JobsOptions = {
  attempts: 2,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 50,
};

export function isQueueEnabled(): boolean {
  return !!process.env.REDIS_URL;
}
