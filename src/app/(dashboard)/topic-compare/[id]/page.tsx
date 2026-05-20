/**
 * @hidden 选题比对 — 模块已解耦暂不开放，如需恢复请在侧边栏添加入口。
 * 如需修改请先确认不影响活跃模块后再操作。
 */

import { notFound } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { getTopicCompareDetail } from "@/lib/dal/topic-compare";
import { TopicDetailClient } from "./topic-detail-client";

export const dynamic = "force-dynamic";

export default async function TopicCompareDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await getCurrentUserOrg();
  if (!orgId) notFound();

  const detail = await getTopicCompareDetail(orgId, id);
  if (!detail) notFound();

  return <TopicDetailClient detail={detail} />;
}
