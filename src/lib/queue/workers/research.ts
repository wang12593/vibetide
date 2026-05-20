import { createWorker } from "../index";
import { db } from "@/db";
import { researchTasks, researchTopicKeywords, mediaOutlets, mediaOutletCrawlConfigs, collectedItems, collectionSources } from "@/db/schema";
import { eq, and, inArray, isNotNull, sql } from "drizzle-orm";
import { crawlTavilyForKeyword } from "@/lib/research/tavily-crawler";
import { fetchArticleContent } from "@/lib/research/jina-fetch";
import { ingestArticle } from "@/lib/research/article-ingest";
import { fetchAndUpdateArticleContent } from "@/lib/research/content-fetch";
import { dispatch } from "../dispatch";

export function registerResearchWorkers() {
  createWorker("research", async (job) => {
    switch (job.name) {
      case "research/task.submitted":
        return taskStartHandler(job.data as { taskId: string });
      case "research/tavily-crawl":
        return tavilyCrawlHandler(job.data as any);
      case "research/whitelist-crawl":
        return whitelistCrawlHandler(job.data as any);
      case "research/article-content-fetch":
        return articleContentFetchHandler(job.data as { articleId: string });
      case "research/bridge.backfill.trigger":
        return bridgeBackfillHandler(job.data as { organizationId?: string; limit?: number });
      default:
        console.warn(`[Research Worker] Unknown job: ${job.name}`);
    }
  }, { concurrency: 5 });
}

async function taskStartHandler(data: { taskId: string }) {
  await db.update(researchTasks).set({ status: "crawling", updatedAt: new Date() }).where(eq(researchTasks.id, data.taskId));

  const task = await db.query.researchTasks.findFirst({ where: eq(researchTasks.id, data.taskId) });
  if (!task) return { skipped: true };

  const keywords = await db.select().from(researchTopicKeywords)
    .where(eq(researchTopicKeywords.topicId, task.topicId!));

  const outlets = await db.select().from(mediaOutlets)
    .where(and(eq(mediaOutlets.organizationId, task.organizationId), eq(mediaOutlets.isWhitelist, true)));

  let tavily = 0, whitelist = 0;
  for (const kw of keywords) {
    await dispatch("research/tavily-crawl", {
      taskId: data.taskId,
      topicId: task.topicId!,
      keywords: [kw.keyword],
      organizationId: task.organizationId,
    });
    tavily++;
  }
  for (const outlet of outlets) {
    await dispatch("research/whitelist-crawl", { taskId: data.taskId, outletId: outlet.id, organizationId: task.organizationId });
    whitelist++;
  }

  return { dispatched: { tavily, whitelist } };
}

async function tavilyCrawlHandler(data: { taskId: string; topicId: string; keywords: string[]; organizationId: string; timeRangeStart?: string; timeRangeEnd?: string; includeDomains?: string[] }) {
  let totalHits = 0, totalInserted = 0;

  for (const keyword of data.keywords) {
    try {
      const results = await crawlTavilyForKeyword({
        keyword,
        includeDomains: data.includeDomains,
        timeRangeStart: data.timeRangeStart,
        timeRangeEnd: data.timeRangeEnd,
      });
      totalHits += results.length;

      for (const r of results) {
        try {
          const content = r.content ?? await fetchArticleContent(r.url).catch(() => "");
          await ingestArticle({
            url: r.url,
            title: r.title ?? "",
            content,
            publishedAt: r.publishedDate,
            sourceChannel: "tavily" as const,
            organizationId: data.organizationId,
            firstSeenResearchTaskId: data.taskId,
          });
          totalInserted++;
        } catch {}
      }
    } catch (err) {
      console.error(`[tavily-crawl] keyword "${keyword}":`, err);
    }
  }

  return { totalHits, totalInserted, topicId: data.topicId };
}

async function whitelistCrawlHandler(data: { taskId: string; outletId: string; organizationId: string }) {
  const outlet = await db.query.mediaOutlets.findFirst({ where: eq(mediaOutlets.id, data.outletId) });
  if (!outlet?.crawlUrl) return { skipped: true, reason: "no crawl URL" };

  try {
    const html = await fetchArticleContent(outlet.crawlUrl);
    const urls = (html.match(/https?:\/\/[^\s"'<>]+/g) ?? [])
      .filter((u) => /^https?:\/\//.test(u) && !u.match(/\.(png|jpg|jpeg|gif|svg|css|js|ico)(\?|$)/i));
    const unique = [...new Set(urls)].slice(0, 50);

    let inserted = 0;
    for (const url of unique) {
      try {
        const content = await fetchArticleContent(url);
        await ingestArticle({
          url,
          title: "",
          content,
          sourceChannel: "whitelist" as const,
          organizationId: data.organizationId,
          firstSeenResearchTaskId: data.taskId,
        });
        inserted++;
      } catch {}
    }
    return { totalDiscovered: unique.length, inserted };
  } catch (err) {
    return { skipped: true, reason: String(err) };
  }
}

async function articleContentFetchHandler(data: { articleId: string }) {
  return fetchAndUpdateArticleContent(data.articleId);
}

async function bridgeBackfillHandler(data: { organizationId?: string; limit?: number }) {
  const limit = data.limit ?? 500;

  const items = await db.select({
    id: collectedItems.id,
    organizationId: collectedItems.organizationId,
    targetModules: collectedItems.targetModules,
  }).from(collectedItems)
    .innerJoin(collectionSources, eq(collectedItems.sourceId, collectionSources.id))
    .where(data.organizationId ? eq(collectedItems.organizationId, data.organizationId) : undefined!)
    .limit(limit);

  if (!items.length) return { bridged: 0, batches: 0 };

  const BATCH = 50;
  let batches = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    for (const item of batch) {
      await dispatch("collection/item.created", {
        itemId: item.id,
        sourceId: "",
        organizationId: item.organizationId,
        targetModules: item.targetModules ?? ["hot_topics"],
      }).catch(() => {});
    }
    batches++;
  }
  return { scanned: items.length, batches };
}
