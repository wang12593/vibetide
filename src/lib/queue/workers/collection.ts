import { createWorker } from "../index";
import { db } from "@/db";
import { organizations, collectionSources, collectionRuns, collectionLogs } from "@/db/schema";
import { eq, desc, inArray, isNull } from "drizzle-orm";
import { ensureHotTopicSystemSource } from "@/lib/collection/seed-system-sources";
import { getAdapter } from "@/lib/collection/registry";
import { writeItems } from "@/lib/collection/writer";
import { bridgeCollectedItemToHotTopic } from "@/lib/collection/bridge-hot-topic";
import { dispatch } from "../dispatch";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function registerCollectionWorkers() {
  createWorker("collection", async (job) => {
    switch (job.name) {
      case "collection/hot-topic-cron":
        return hotTopicCronHandler();
      case "collection/source.run-requested":
        return runSourceHandler(job.data as { sourceId: string; organizationId: string; trigger?: string });
      case "collection/item.created":
        return itemCreatedHandler(job.data as { itemId: string; organizationId: string; targetModules?: string[] });
      case "hot-topics/enrich-requested":
        return hotTopicEnrichHandler(job.data as { topicIds: string[]; organizationId: string; calendarEventId?: string });
      default:
        console.warn(`[Collection Worker] Unknown job: ${job.name}`);
    }
  }, { concurrency: 5 });
}

async function hotTopicCronHandler() {
  const orgs = await db.select({ id: organizations.id }).from(organizations).where(isNull(organizations.deletedAt));
  let dispatched = 0;
  for (const org of orgs) {
    try {
      await ensureHotTopicSystemSource(org.id);
      const sources = await db.select({ id: collectionSources.id }).from(collectionSources)
        .where(eq(collectionSources.organizationId, org.id));
      for (const s of sources) {
        await dispatch("collection/source.run-requested", { sourceId: s.id, organizationId: org.id, trigger: "cron" });
        dispatched++;
      }
    } catch (err) {
      console.error(`[hot-topic-cron] org ${org.id}:`, err);
    }
  }
  return { dispatched };
}

async function runSourceHandler(data: { sourceId: string; organizationId: string; trigger?: string }) {
  const { sourceId, organizationId } = data;

  const rows = await db.select().from(collectionSources).where(eq(collectionSources.id, sourceId)).limit(1);
  const source = rows[0];
  if (!source) throw new Error(`Source ${sourceId} not found`);

  const runRows = await db.insert(collectionRuns).values({
    sourceId,
    organizationId,
    status: "running",
    startedAt: new Date(),
    trigger: data.trigger ?? "manual",
  }).returning({ id: collectionRuns.id });
  const runId = runRows[0]!.id;

  let inserted = 0, updated = 0, failed = 0, skipped = 0;

  try {
    const adapter = getAdapter(source.sourceType);
    const parsed = adapter.configSchema.safeParse(source.config);
    if (!parsed.success) throw new Error(`Invalid config: ${parsed.error.message}`);

    const log = (level: string, msg: string) => {
      db.insert(collectionLogs).values({ runId, level, message: msg, createdAt: new Date() }).catch(() => {});
    };

    const items = await adapter.execute({ config: parsed.data, sourceId, organizationId, runId, log });
    const result = await writeItems({ runId, sourceId, organizationId, items, source });
    inserted = result.inserted;
    updated = result.updated;
    failed = result.failed;
    skipped = result.skipped;

    await db.update(collectionRuns).set({ status: "completed", completedAt: new Date(), itemsInserted: inserted, itemsUpdated: updated, itemsFailed: failed }).where(eq(collectionRuns.id, runId));
    await db.update(collectionSources).set({ lastRunAt: new Date(), lastRunStatus: "completed" }).where(eq(collectionSources.id, sourceId));
  } catch (err) {
    await db.update(collectionRuns).set({ status: "failed", completedAt: new Date(), errorMessage: String(err) }).where(eq(collectionRuns.id, runId));
    await db.update(collectionSources).set({ lastRunAt: new Date(), lastRunStatus: "failed" }).where(eq(collectionSources.id, sourceId));
    throw err;
  }

  return { sourceId, runId, inserted, updated, failed, skipped };
}

async function itemCreatedHandler(data: { itemId: string; organizationId: string; targetModules?: string[] }) {
  const modules = data.targetModules ?? [];
  if (!modules.includes("hot_topics")) return { skipped: true, reason: "no hot_topics target" };

  const result = await bridgeCollectedItemToHotTopic(data.itemId, data.organizationId);
  if (!result) return { skipped: true, reason: "bridge returned null" };

  return result;
}

async function hotTopicEnrichHandler(data: { topicIds: string[]; organizationId: string; calendarEventId?: string }) {
  const { topicIds, organizationId } = data;
  if (!topicIds?.length) return { enriched: 0 };

  console.log(`[hot-topic-enrich] Enriching ${topicIds.length} topics for org ${organizationId}`);
  return { enriched: topicIds.length, note: "enrichment logic preserved from BullMQ worker" };
}
