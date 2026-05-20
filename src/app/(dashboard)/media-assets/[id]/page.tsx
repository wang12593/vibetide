/**
 * @hidden 媒资管理 — 模块已解耦暂不开放，如需恢复请在侧边栏添加入口。
 * 如需修改请先确认不影响活跃模块后再操作。
 */

import { notFound } from "next/navigation";
import { getAssetDetailFull } from "@/lib/dal/assets";
import AssetDetailClient from "./asset-detail-client";

export const dynamic = "force-dynamic";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const asset = await getAssetDetailFull(id).catch(() => undefined);

  if (!asset) notFound();

  return <AssetDetailClient asset={asset} />;
}
