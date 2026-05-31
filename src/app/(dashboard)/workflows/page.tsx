export const dynamic = "force-dynamic";

import { getMyWorkflows, getBuiltinTemplates } from "@/lib/dal/workflow-templates";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/rbac";
import { WorkflowsClient } from "./workflows-client";
import type { WorkflowTemplateRow } from "@/db/types";

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 15000): Promise<T> {
  return Promise.race([
    promise.catch((err) => { console.error("[workflows] withTimeout failed:", err); return fallback; }),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export default async function WorkflowsPage() {
  let myWorkflows: WorkflowTemplateRow[] = [];
  let builtinTemplates: WorkflowTemplateRow[] = [];
  let isAdmin = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const [admin, builtin] = await Promise.all([
        withTimeout(isSuperAdmin(user.id), false),
        withTimeout(getBuiltinTemplates(), []),
      ]);
      isAdmin = admin;
      myWorkflows = await withTimeout(getMyWorkflows(user.id, { isAdmin: admin }), []);
      builtinTemplates = builtin;
    }
  } catch {
    // Graceful degradation — render empty state
  }

  return (
    <WorkflowsClient
      myWorkflows={myWorkflows}
      builtinTemplates={builtinTemplates}
      isAdmin={isAdmin}
    />
  );
}
