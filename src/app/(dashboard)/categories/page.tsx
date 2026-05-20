/**
 * @hidden 文章管理 — 模块已解耦暂不开放，如需恢复请在侧边栏添加入口。
 * 如需修改请先确认不影响活跃模块后再操作。
 */

import { getCategoryTree } from "@/lib/dal/categories";
import CategoriesClient from "./categories-client";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categoryTree = await getCategoryTree().catch(() => []);
  return <CategoriesClient categoryTree={categoryTree} />;
}
