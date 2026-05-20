import cron from "node-cron";
import { QUEUES } from "./index";

interface ScheduledJob {
  cron: string;
  queueName: keyof typeof QUEUES;
  jobName: string;
  data?: Record<string, unknown>;
}

const SCHEDULED_JOBS: ScheduledJob[] = [
  { cron: "0 * * * *", queueName: "collection", jobName: "collection/hot-topic-cron" },
  { cron: "0 0 * * *", queueName: "scheduled", jobName: "scheduled/daily-hot-briefing" },
  { cron: "0 9 * * 1", queueName: "scheduled", jobName: "scheduled/weekly-analytics-report" },
  { cron: "*/30 * * * *", queueName: "scheduled", jobName: "scheduled/employee-status-guard" },
  { cron: "5 0 * * *", queueName: "scheduled", jobName: "scheduled/daily-performance-snapshot" },
  { cron: "0 2 * * *", queueName: "scheduled", jobName: "scheduled/learning-engine" },
  { cron: "30 2 * * *", queueName: "scheduled", jobName: "scheduled/skill-consistency-check" },
  { cron: "30 3 * * *", queueName: "scheduled", jobName: "scheduled/memory-decay" },
  { cron: "0 2 * * *", queueName: "cms", jobName: "cms/catalog-sync-daily" },
];

export function startScheduler() {
  for (const job of SCHEDULED_JOBS) {
    cron.schedule(job.cron, () => {
      QUEUES[job.queueName].add(job.jobName, job.data ?? {}, {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true,
      }).catch((err) => {
        console.error(`[Scheduler] Failed to queue ${job.jobName}:`, err.message);
      });
    });
    console.debug(`[Scheduler] Registered: ${job.cron} → ${job.jobName}`);
  }
}
