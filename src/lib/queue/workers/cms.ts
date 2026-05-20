import { createWorker, QUEUES } from "../index";
import { getPublicationById, markAsSynced, markAsRejectedByCms } from "@/lib/dal/cms-publications";
import { requireCmsConfig, CmsClient, getArticleDetail, mapCmsStatusToPublicationState, classifyCmsError } from "@/lib/cms";
import { publishArticleToCms } from "@/lib/cms/publish/publish-article";
import { syncCmsCatalogs } from "@/lib/cms";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { isNull } from "drizzle-orm";

const POLL_DELAYS = [5000, 10000, 20000, 40000, 120000];
const RETRY_DELAYS = [1000, 5000, 30000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function cmsStatusPollHandler(job: { name: string; data: { publicationId: string; cmsArticleId: string } }) {
  const { publicationId, cmsArticleId } = job.data;
  const config = await requireCmsConfig();
  const client = new CmsClient(config);

  for (let attempt = 0; attempt < POLL_DELAYS.length; attempt++) {
    const pub = await getPublicationById(publicationId);
    if (!pub || pub.syncState === "synced" || pub.syncState === "rejected") {
      return { publicationId, attempts: attempt, terminal: true };
    }

    try {
      const detail = await getArticleDetail(client, cmsArticleId);
      const mapped = mapCmsStatusToPublicationState(detail.status);
      if (mapped === "synced") {
        await markAsSynced(publicationId);
        return { publicationId, attempts: attempt + 1, terminal: true };
      }
      if (mapped === "rejected") {
        await markAsRejectedByCms(publicationId);
        return { publicationId, attempts: attempt + 1, terminal: true };
      }
    } catch (err) {
      const classified = classifyCmsError(err);
      if (classified.terminal) {
        await markAsRejectedByCms(publicationId);
        return { publicationId, attempts: attempt + 1, terminal: true };
      }
    }

    if (attempt < POLL_DELAYS.length - 1) {
      await sleep(POLL_DELAYS[attempt]);
    }
  }

  return { publicationId, attempts: POLL_DELAYS.length, terminal: false };
}

async function cmsPublishRetryHandler(job: { data: { publicationId: string } }) {
  const { publicationId } = job.data;
  const pub = await getPublicationById(publicationId);
  if (!pub || pub.syncState === "synced") return { skipped: true };

  const maxAttempts = RETRY_DELAYS.length;
  if ((pub.retryCount ?? 0) >= maxAttempts) return { exhausted: true };

  const { incrementAttempt } = await import("@/lib/dal/cms-publications");
  await incrementAttempt(publicationId);

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await publishArticleToCms({
        articleId: pub.articleId,
        operatorId: pub.operatorId ?? undefined,
        triggerSource: "retry",
        allowUpdate: true,
      });
      return { success: true, cmsState: result };
    } catch {
      if (i < RETRY_DELAYS.length - 1) await sleep(RETRY_DELAYS[i]);
    }
  }

  return { success: false, error: "All retry attempts exhausted" };
}

async function cmsCatalogSyncHandler(job: { name: string; data: { organizationId?: string; triggerSource?: string; operatorId?: string; deleteMissing?: boolean } }) {
  if (job.data.organizationId) {
    return syncCmsCatalogs(job.data.organizationId, {
      triggerSource: job.data.triggerSource ?? "on-demand",
      operatorId: job.data.operatorId,
      deleteMissing: job.data.deleteMissing ?? false,
    });
  }

  const orgs = await db.select({ id: organizations.id }).from(organizations).where(isNull(organizations.deletedAt));
  const results = [];
  for (const org of orgs) {
    try {
      const r = await syncCmsCatalogs(org.id, { triggerSource: "daily-cron", deleteMissing: false });
      results.push({ orgId: org.id, ...r });
    } catch (err) {
      results.push({ orgId: org.id, error: String(err) });
    }
  }
  return { totalOrgs: orgs.length, results };
}

export function registerCmsWorkers() {
  createWorker("cms", async (job) => {
    switch (job.name) {
      case "cms/publication.submitted":
        return cmsStatusPollHandler(job as any);
      case "cms/publication.retry":
        return cmsPublishRetryHandler(job as any);
      case "cms/catalog-sync":
      case "cms/catalog-sync-daily":
        return cmsCatalogSyncHandler(job as any);
      default:
        console.warn(`[CMS Worker] Unknown job: ${job.name}`);
    }
  }, { concurrency: 3 });
}
