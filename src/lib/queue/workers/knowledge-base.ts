import { createWorker } from "../index";
import { db } from "@/db";
import { knowledgeBases, knowledgeItems, knowledgeSyncLogs } from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { generateEmbeddings, getEmbeddingModel } from "@/lib/knowledge/embeddings";

const BATCH_SIZE = 50;

async function vectorizeKnowledgeBase(kbId: string) {
  await db
    .update(knowledgeBases)
    .set({ vectorizationStatus: "processing", updatedAt: new Date() })
    .where(eq(knowledgeBases.id, kbId));

  let totalProcessed = 0;
  let batchNum = 0;
  let hasError = false;
  let lastError = "";

  while (true) {
    const pending = await db
      .select({ id: knowledgeItems.id, fullContent: knowledgeItems.fullContent })
      .from(knowledgeItems)
      .where(and(eq(knowledgeItems.knowledgeBaseId, kbId), isNull(knowledgeItems.embedding)))
      .limit(BATCH_SIZE);

    if (pending.length === 0) break;

    try {
      const texts = pending.map((p) => p.fullContent || "");
      const embeddings = await generateEmbeddings(texts);
      const model = getEmbeddingModel();

      for (let i = 0; i < pending.length; i++) {
        await db
          .update(knowledgeItems)
          .set({ embedding: embeddings[i], embeddingModel: model, updatedAt: new Date() })
          .where(eq(knowledgeItems.id, pending[i].id));
      }

      totalProcessed += pending.length;
      batchNum++;
      if (pending.length < BATCH_SIZE) break;
    } catch (err) {
      hasError = true;
      lastError = err instanceof Error ? err.message : String(err);
      break;
    }
  }

  const finalStatus = hasError ? "failed" : "done";
  const countRow = await db
    .select({ c: sql<number>`COUNT(*)::int` })
    .from(knowledgeItems)
    .where(eq(knowledgeItems.knowledgeBaseId, kbId));
  const totalChunks = Number(countRow[0]?.c || 0);

  await db
    .update(knowledgeBases)
    .set({ vectorizationStatus: finalStatus, chunkCount: totalChunks, lastSyncAt: new Date(), updatedAt: new Date() })
    .where(eq(knowledgeBases.id, kbId));

  await db.insert(knowledgeSyncLogs).values({
    knowledgeBaseId: kbId,
    action: "vectorize",
    status: hasError ? "error" : "success",
    detail: hasError ? `向量化失败：${lastError}` : `成功生成 ${totalProcessed} 个 chunks 的向量`,
    chunksGenerated: totalProcessed,
    errorsCount: hasError ? 1 : 0,
  });
}

export function registerKnowledgeBaseWorkers() {
  createWorker("knowledgeBase", async (job) => {
    await vectorizeKnowledgeBase(job.data.knowledgeBaseId);
  }, { concurrency: 2 });
}
