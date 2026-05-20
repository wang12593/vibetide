export const dynamic = "force-dynamic";

/**
 * @hidden 渠道顾问 — 模块已解耦暂不开放，如需恢复请在侧边栏添加入口。
 * 如需修改请先确认不影响活跃模块后再操作。
 */

import { getKnowledgeSources, getKnowledgeItems, getChannelDNA, getSyncLogs } from "@/lib/dal/channel-advisors";
import ChannelKnowledgeClient from "./channel-knowledge-client";

export default async function ChannelKnowledgePage() {
  const [sources, items, dna, syncLogs] = await Promise.all([
    getKnowledgeSources().catch(() => ({ upload: [], cms: [], subscription: [], stats: { totalDocuments: 0, totalChunks: 0, lastSync: "" } })),
    getKnowledgeItems().catch(() => []),
    getChannelDNA().catch(() => ({ dimensions: [], report: "" })),
    getSyncLogs().catch(() => []),
  ]);

  return (
    <ChannelKnowledgeClient
      sources={sources}
      items={items}
      dna={dna}
      syncLogs={syncLogs}
    />
  );
}
