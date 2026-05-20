export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { listKnowledgeBaseSummariesByOrg } from "@/lib/dal/knowledge-bases";
import {
  getKnowledgeSources,
  getKnowledgeItems,
  getChannelDNA,
  getSyncLogs,
} from "@/lib/dal/channel-advisors";
import { KnowledgeBasesClient } from "./knowledge-bases-client";

export default async function KnowledgeBasesPage() {
  const orgId = await getCurrentUserOrg();
  if (!orgId) redirect("/login");

  const [summaries, channelSources, channelItems, channelDNA, channelSyncLogs] =
    await Promise.all([
      listKnowledgeBaseSummariesByOrg(orgId).catch((err) => { console.error("[knowledge-bases] load summaries failed:", err); return []; }),
      getKnowledgeSources().catch((err) => { console.error("[knowledge-bases] load channel sources failed:", err); return {
        upload: [],
        cms: [],
        subscription: [],
        stats: { totalDocuments: 0, totalChunks: 0, lastSync: "" },
      }; }),
      getKnowledgeItems().catch((err) => { console.error("[knowledge-bases] load channel items failed:", err); return []; }),
      getChannelDNA().catch((err) => { console.error("[knowledge-bases] load channel DNA failed:", err); return { dimensions: [], report: "" }; }),
      getSyncLogs().catch((err) => { console.error("[knowledge-bases] load sync logs failed:", err); return []; }),
    ]);

  return (
    <KnowledgeBasesClient
      initialSummaries={summaries}
      channelData={{
        sources: channelSources,
        items: channelItems,
        dna: channelDNA,
        syncLogs: channelSyncLogs,
      }}
    />
  );
}
