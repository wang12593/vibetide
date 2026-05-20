import { getCurrentUserProfile } from "@/lib/dal/auth";
import { redirect } from "next/navigation";
import { MulanConfigClient } from "./mulan-config-client";
import { getWorkflowTemplates } from "@/lib/dal/workflow-templates";
import { getEmployees } from "@/lib/dal/employees";
import { getKnowledgeBases } from "@/lib/dal/knowledge-bases";

export const dynamic = "force-dynamic";

export default async function MulanConfigPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/home");

  const [wfData, empData, kbData] = await Promise.all([
    getWorkflowTemplates().catch((err) => { console.error("[mulan-config] load workflows failed:", err); return []; }),
    getEmployees({ userId: profile.userId, isAdmin: profile.isSuperAdmin }).catch((err) => { console.error("[mulan-config] load employees failed:", err); return []; }),
    getKnowledgeBases().catch((err) => { console.error("[mulan-config] load knowledge bases failed:", err); return []; }),
  ]);

  const workflows = (Array.isArray(wfData) ? wfData : (wfData as { templates?: unknown[] })?.templates || []).map((w: unknown) => {
    const item = w as Record<string, unknown>;
    return {
      id: item.id as string,
      name: item.name as string,
      description: (item.description as string) || null,
      isEnabled: (item.isEnabled as boolean) ?? true,
      isBuiltin: (item.isBuiltin as boolean) ?? false,
    };
  });

  const employees = (empData as Record<string, unknown>[]).map((e) => ({
    id: e.id as string,
    dbId: (e.dbId as string) || "",
    name: e.name as string,
    nickname: e.nickname as string,
    slug: (e.slug as string) || (e.id as string),
    role: (e.role as string) || (e.title as string) || "",
    isPreset: (e.isPreset as number) === 1,
    disabled: (e.disabled as number) === 1,
  }));

  const knowledgeBases = (Array.isArray(kbData) ? kbData : (kbData as { knowledgeBases?: unknown[] })?.knowledgeBases || []).map((k: unknown) => {
    const item = k as Record<string, unknown>;
    return {
      id: item.id as string,
      name: item.name as string,
      description: (item.description as string) || null,
      documentCount: (item.documentCount as number) || (item.document_count as number) || 0,
    };
  });

  return (
    <MulanConfigClient
      initialWorkflows={workflows}
      initialEmployees={employees}
      initialKnowledgeBases={knowledgeBases}
    />
  );
}
