/**
 * @hidden 文章管理 — 模块已解耦暂不开放，如需恢复请在侧边栏添加入口。
 * 如需修改请先确认不影响活跃模块后再操作。
 */

import { getCategories } from "@/lib/dal/categories";
import ArticleCreateClient from "./article-create-client";

export const dynamic = "force-dynamic";

export default async function ArticleCreatePage() {
  const categories = await getCategories().catch(() => []);
  return <ArticleCreateClient categories={categories} />;
}
