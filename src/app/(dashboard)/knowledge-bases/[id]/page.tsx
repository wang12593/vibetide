export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  getKnowledgeBaseById,
  listKnowledgeItems,
  getKnowledgeBaseBindings,
  getKnowledgeBaseSyncLogs,
} from "@/lib/dal/knowledge-bases";
import { KBDetailClient } from "./kb-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function KnowledgeBaseDetailPage({ params }: PageProps) {
  const { id } = await params;

  const orgId = await getCurrentUserOrg();
  if (!orgId) redirect("/login");

  const kb = await getKnowledgeBaseById(orgId, id);
  if (!kb) notFound();

  const [itemsResult, bindings, syncLogs] = await Promise.all([
    listKnowledgeItems(orgId, id, { page: 1, pageSize: 20 }).catch((err) => { console.error("[kb-detail] load items failed:", err); return {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    }; }),
    getKnowledgeBaseBindings(orgId, id).catch((err) => { console.error("[kb-detail] load bindings failed:", err); return []; }),
    getKnowledgeBaseSyncLogs(orgId, id, 50).catch((err) => { console.error("[kb-detail] load sync logs failed:", err); return []; }),
  ]);

  return (
    <KBDetailClient
      kb={kb}
      initialItems={itemsResult}
      bindings={bindings}
      syncLogs={syncLogs}
    />
  );
}
