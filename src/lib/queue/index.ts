import { Queue, Worker, type Processor } from "bullmq";
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

connection.on("error", (err) => {
  console.error("[BullMQ] Redis connection error:", err.message);
});

export const QUEUES = {
  knowledgeBase: new Queue("knowledge-base", { connection }),
  cms: new Queue("cms", { connection }),
  collection: new Queue("collection", { connection }),
  research: new Queue("research", { connection }),
  scheduled: new Queue("scheduled", { connection }),
  publishing: new Queue("publishing", { connection }),
} as const;

export type QueueName = keyof typeof QUEUES;

export function createWorker(
  queueName: QueueName,
  processor: Processor,
  opts?: { concurrency?: number },
) {
  return new Worker(QUEUES[queueName].name, processor, {
    connection,
    concurrency: opts?.concurrency ?? 5,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  });
}

export { connection };
