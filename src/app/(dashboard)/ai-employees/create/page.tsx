export const dynamic = "force-dynamic";

import { getSkills } from "@/lib/dal/skills";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { listKnowledgeBaseSummariesByOrg } from "@/lib/dal/knowledge-bases";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/rbac";
import { CreateEmployeeClient } from "./create-employee-client";

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 15000): Promise<T> {
  return Promise.race([
    promise.catch((err) => { console.error("[ai-employees/create] withTimeout failed:", err); return fallback; }),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export default async function CreateEmployeePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = user ? await isSuperAdmin(user.id) : false;
  const orgId = await withTimeout(getCurrentUserOrg(), null);

  const [skills, knowledgeBases] = await Promise.all([
    withTimeout(getSkills(undefined, user ? { userId: user.id, isAdmin: admin } : undefined), []),
    orgId
      ? withTimeout(listKnowledgeBaseSummariesByOrg(orgId), [])
      : Promise.resolve([]),
  ]);

  return (
    <CreateEmployeeClient
      skills={skills}
      knowledgeBases={knowledgeBases.map((kb) => ({
        id: kb.id,
        name: kb.name,
        description: kb.description,
        type: kb.type,
        documentCount: kb.documentCount,
      }))}
    />
  );
}
