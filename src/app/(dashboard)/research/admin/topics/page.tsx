/**
 * @hidden 研究工作台 — 模块已解耦暂不开放，如需恢复请在侧边栏添加入口。
 * 如需修改请先确认不影响活跃模块后再操作。
 */

import { redirect } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/rbac-constants";
import { listResearchTopics } from "@/lib/dal/research/research-topics";
import { TopicsClient } from "./topics-client";

export const dynamic = "force-dynamic";

export default async function TopicsAdminPage() {
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) redirect("/login");

  const allowed = await hasPermission(
    ctx.userId,
    ctx.organizationId,
    PERMISSIONS.RESEARCH_TOPIC_MANAGE,
  );
  if (!allowed) redirect("/research");

  const topics = await listResearchTopics(ctx.organizationId);
  return <TopicsClient topics={topics} />;
}
