export const dynamic = "force-dynamic";

/**
 * @hidden 超级创作 — 模块已解耦暂不开放，如需恢复请在侧边栏添加入口。
 * 如需修改请先确认不影响活跃模块后再操作。
 */

import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  getHitTemplates,
  getDefaultEDLProject,
} from "@/lib/dal/creation";
import { PremiumContentClient } from "./premium-content-client";

export default async function PremiumContentPage() {
  let hitTemplates: Awaited<ReturnType<typeof getHitTemplates>> = [];

  try {
    const orgId = await getCurrentUserOrg();
    if (orgId) {
      hitTemplates = await getHitTemplates(orgId);
    }
  } catch {
    // Gracefully degrade when DB is unavailable
  }

  const edlProject = getDefaultEDLProject();

  return (
    <PremiumContentClient
      pipelineNodes={[]}
      hitTemplates={hitTemplates}
      edlProject={edlProject}
      activityLogs={[]}
    />
  );
}
