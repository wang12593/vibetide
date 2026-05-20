import { QUEUES, type QueueName } from "./index";

type EventMap = {
  "kb/document-created": { knowledgeBaseId: string; organizationId: string };
  "kb/reindex-requested": { knowledgeBaseId: string; organizationId: string };
  "cms/publication.submitted": { publicationId: string; cmsArticleId: string };
  "cms/publication.retry": { publicationId: string };
  "collection/item.created": { itemId: string; sourceId: string; organizationId: string; targetModules?: string[]; firstSeenChannel?: string };
  "collection/source.run-requested": { sourceId: string; organizationId: string; trigger?: string };
  "hot-topics/enrich-requested": { organizationId: string; topicIds: string[]; calendarEventId?: string };
  "research/task.submitted": { taskId: string };
  "research/whitelist-crawl": { taskId: string; outletId: string; organizationId: string };
  "research/tavily-crawl": { taskId: string; topicId: string; keywords: string[]; organizationId: string };
  "research/article-content-fetch": { articleId: string };
  "research/bridge.backfill.trigger": { sampleId: string; topicId: string; operation: string };
  "publishing/review.completed": { articleId: string; reviewerId: string };
  "publishing/plan.status-changed": { planId: string; status: string };
  "publishing/anomaly.detected": { type: string; details: Record<string, unknown> };
  "employee/learn": { employeeId: string; missionId: string };
};

const EVENT_QUEUE_MAP: Record<string, QueueName> = {
  "kb/document-created": "knowledgeBase",
  "kb/reindex-requested": "knowledgeBase",
  "cms/publication.submitted": "cms",
  "cms/publication.retry": "cms",
  "collection/item.created": "collection",
  "collection/source.run-requested": "collection",
  "hot-topics/enrich-requested": "collection",
  "research/task.submitted": "research",
  "research/whitelist-crawl": "research",
  "research/tavily-crawl": "research",
  "research/article-content-fetch": "research",
  "research/bridge.backfill.trigger": "research",
  "publishing/review.completed": "publishing",
  "publishing/plan.status-changed": "publishing",
  "publishing/anomaly.detected": "publishing",
  "employee/learn": "scheduled",
};

export async function dispatch<K extends keyof EventMap>(
  event: K,
  data: EventMap[K],
): Promise<void> {
  const queueName = EVENT_QUEUE_MAP[event];
  if (!queueName || !QUEUES[queueName]) {
    console.error(`[dispatch] Unknown queue for event "${event}"`);
    return;
  }

  try {
    await QUEUES[queueName].add(event, data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: true,
    });
  } catch (err) {
    console.error(`[dispatch] Failed for "${event}":`, err instanceof Error ? err.message : String(err));
  }
}

export async function dispatchScheduled(
  queueName: QueueName,
  jobName: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  try {
    await QUEUES[queueName].add(jobName, data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: true,
    });
  } catch (err) {
    console.error(`[dispatchScheduled] Failed for "${jobName}":`, err instanceof Error ? err.message : String(err));
  }
}
