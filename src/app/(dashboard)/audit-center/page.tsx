/**
 * @hidden 三级审核 — 模块已解耦暂不开放，如需恢复请在侧边栏添加入口。
 * 如需修改请先确认不影响活跃模块后再操作。
 */

import { getCurrentUserOrg } from "@/lib/dal/auth";
import { getAuditStats, listPendingAudits } from "@/lib/dal/audit";
import { AuditCenterClient } from "./audit-center-client";

export const dynamic = "force-dynamic";

export default async function AuditCenterPage() {
  const orgId = await getCurrentUserOrg();

  const [stats, pendingAudits] = orgId
    ? await Promise.all([
        getAuditStats(orgId),
        listPendingAudits(orgId),
      ])
    : [
        { pendingCount: 0, approvedToday: 0, rejectedToday: 0, avgReviewTimeMs: null },
        [],
      ];

  return <AuditCenterClient stats={stats} pendingAudits={pendingAudits} />;
}
