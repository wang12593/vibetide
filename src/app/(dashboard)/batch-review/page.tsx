export const dynamic = "force-dynamic";

/**
 * @hidden 三级审核 — 模块已解耦暂不开放，如需恢复请在侧边栏添加入口。
 * 如需修改请先确认不影响活跃模块后再操作。
 */

import { getCurrentUserOrg } from "@/lib/dal/auth";
import { getReviewResults } from "@/lib/dal/reviews";
import { getComplianceHistory } from "@/lib/dal/compliance";
import { BatchReviewClient } from "./batch-review-client";

export default async function BatchReviewPage() {
  let reviews: Awaited<ReturnType<typeof getReviewResults>> = [];
  let complianceHistory: Awaited<ReturnType<typeof getComplianceHistory>> = [];

  try {
    const orgId = await getCurrentUserOrg();
    if (orgId) {
      [reviews, complianceHistory] = await Promise.all([
        getReviewResults(orgId),
        getComplianceHistory(orgId, 50),
      ]);
    }
  } catch {
    // Gracefully degrade when DB is unavailable
  }

  return (
    <BatchReviewClient
      reviews={reviews}
      complianceHistory={complianceHistory}
    />
  );
}
