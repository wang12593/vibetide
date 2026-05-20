/**
 * @hidden 文章管理 — 模块已解耦暂不开放，如需恢复请在侧边栏添加入口。
 * 如需修改请先确认不影响活跃模块后再操作。
 */

import { getArticles, getArticleStats } from "@/lib/dal/articles";
import { getCategories } from "@/lib/dal/categories";
import ArticlesClient from "./articles-client";

export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  const [articles, stats, categories] = await Promise.all([
    getArticles().catch(() => []),
    getArticleStats().catch(() => ({ totalCount: 0, draftCount: 0, reviewingCount: 0, approvedCount: 0, publishedCount: 0, todayCount: 0 })),
    getCategories().catch(() => []),
  ]);

  return <ArticlesClient articles={articles} stats={stats} categories={categories} />;
}
