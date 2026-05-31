import { getMissionsWithActiveTasks } from "@/lib/dal/missions";
import { MissionsClient } from "./missions-client";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { createClient } from "@/lib/supabase/server";
import { cleanupStuckMissions } from "@/app/actions/missions";
import { listWorkflowTemplatesByOrg } from "@/lib/dal/workflow-templates";
import { isSuperAdmin } from "@/lib/rbac";
import type { WorkflowTemplateRow } from "@/db/types";
import { after } from "next/server";

export const dynamic = "force-dynamic";

export default async function MissionsPage() {
  const orgId = await getCurrentUserOrg();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin = user ? await isSuperAdmin(user.id) : false;

  const missions = orgId ? await getMissionsWithActiveTasks(orgId, { userId: user?.id, mode: "own" }) : [];

  // B.1 Unified Scenario Workflow — fetch all enabled workflow templates
  // for this org so <MissionsClient> can render them (Task 18 consumes the
  // prop in the "发起新任务" Sheet).
  let workflows: WorkflowTemplateRow[] = [];
  if (orgId) {
    try {
      workflows = await listWorkflowTemplatesByOrg(orgId, {
        isEnabled: true,
      }, { userId: user?.id, isAdmin });
    } catch (err) {
      console.error("[missions page] Failed to load workflows:", err);
    }
  }

  // 页面加载时自动清理卡住的任务和数字员工
  if (orgId) {
    after(async () => {
      await cleanupStuckMissions().catch(() => {});
    });
  }

  return (
    <MissionsClient missions={missions} workflows={workflows} />
  );
}
