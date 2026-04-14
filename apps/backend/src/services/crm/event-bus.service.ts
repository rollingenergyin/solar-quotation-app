/**
 * Event Bus — Redis Streams via BullMQ.
 * Falls back to an in-process emitter if REDIS_URL is not set (development).
 */
import { EventEmitter } from 'events';

export type BusEvent = {
  event: string;
  leadId: string;
  eventId: string;
  payload: Record<string, unknown>;
  ts: number;
};

type Handler = (e: BusEvent) => Promise<void>;

// In-process fallback (used in dev without Redis)
const emitter = new EventEmitter();
emitter.setMaxListeners(50);

let bullQueue: import('bullmq').Queue | null = null;
let bullWorker: import('bullmq').Worker | null = null;

async function getQueue() {
  if (bullQueue) return bullQueue;
  if (!process.env.REDIS_URL) return null;

  const { Queue } = await import('bullmq');
  bullQueue = new Queue('crm-events', {
    connection: { url: process.env.REDIS_URL },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });
  return bullQueue;
}

const handlers: Map<string, Handler[]> = new Map();

export function onEvent(eventPattern: string, handler: Handler) {
  const list = handlers.get(eventPattern) ?? [];
  list.push(handler);
  handlers.set(eventPattern, list);

  // Also register on in-process emitter
  emitter.on(eventPattern, handler);
}

export async function emitEvent(bus: BusEvent) {
  const queue = await getQueue();
  if (queue) {
    await queue.add(bus.event, bus, { jobId: `${bus.event}:${bus.eventId}` });
    return;
  }
  // Fallback: fire synchronously in-process
  const list = handlers.get(bus.event) ?? [];
  for (const h of list) {
    try { await h(bus); } catch (e) { console.error('[EventBus] handler error', e); }
  }
}

/**
 * Must be called once at server startup to wire the BullMQ worker.
 */
export async function startEventWorker() {
  if (!process.env.REDIS_URL) return;
  const { Worker } = await import('bullmq');
  bullWorker = new Worker(
    'crm-events',
    async (job) => {
      const busEvent = job.data as BusEvent;
      const list = handlers.get(busEvent.event) ?? [];
      for (const h of list) {
        await h(busEvent);
      }
    },
    { connection: { url: process.env.REDIS_URL }, concurrency: 10 }
  );
  bullWorker.on('failed', (job, err) => {
    console.error(`[EventBus] Job ${job?.id} failed:`, err.message);
  });
  console.log('[EventBus] BullMQ worker started');
}
