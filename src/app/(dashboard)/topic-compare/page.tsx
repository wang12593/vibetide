/**
 * @hidden 选题比对 — 模块已解耦暂不开放，如需恢复请在侧边栏添加入口。
 * 如需修改请先确认不影响活跃模块后再操作。
 */

import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  listTopicCompareItems,
  listTopicComparePlatformOptions,
  type TopicCompareListRow,
} from "@/lib/dal/topic-compare";
import { TopicCompareClient } from "./topic-compare-client";

export const dynamic = "force-dynamic";

export default async function TopicComparePage() {
  let items: TopicCompareListRow[] = [];
  let platformOptions: Awaited<ReturnType<typeof listTopicComparePlatformOptions>> = [];

  try {
    const orgId = await getCurrentUserOrg();
    if (orgId) {
      [items, platformOptions] = await Promise.all([
        listTopicCompareItems(orgId, { limit: 100 }),
        listTopicComparePlatformOptions(orgId),
      ]);
    }
  } catch (err) {
    console.error("[topic-compare] 加载失败:", err);
  }

  return <TopicCompareClient items={items} platformOptions={platformOptions} />;
}
