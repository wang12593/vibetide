/**
 * @hidden 媒资管理 — 模块已解耦暂不开放，如需恢复请在侧边栏添加入口。
 * 如需修改请先确认不影响活跃模块后再操作。
 */

import { getAssetsByLibrary, getLibraryStats, getMediaCategoryTree } from "@/lib/dal/assets";
import MediaAssetsModuleClient from "./media-assets-client";
import type { MediaLibraryType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MediaAssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ library?: string }>;
}) {
  const params = await searchParams;
  const library = (params.library || "personal") as MediaLibraryType;

  const [assetsResult, stats, categories] = await Promise.all([
    getAssetsByLibrary(library, null, 1, 20).catch(() => ({
      items: [], total: 0, page: 1, pageSize: 20, totalPages: 0,
    })),
    getLibraryStats(library).catch(() => ({
      totalCount: 0, videoCount: 0, imageCount: 0, audioCount: 0,
      documentCount: 0, totalStorageDisplay: "0",
    })),
    library === "product"
      ? getMediaCategoryTree().catch(() => [])
      : Promise.resolve([]),
  ]);

  return (
    <MediaAssetsModuleClient
      initialAssets={assetsResult}
      initialStats={stats}
      categories={categories}
      initialLibrary={library}
    />
  );
}
