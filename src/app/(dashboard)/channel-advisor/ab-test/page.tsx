export const dynamic = "force-dynamic";

/**
 * @hidden 渠道顾问 — 模块已解耦暂不开放，如需恢复请在侧边栏添加入口。
 * 如需修改请先确认不影响活跃模块后再操作。
 */

import { getChannelAdvisors } from "@/lib/dal/channel-advisors";
import { getAbTests } from "@/lib/dal/advisor-tests";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import AbTestClient from "./ab-test-client";

export default async function AdvisorAbTestPage() {
  const orgId = await getCurrentUserOrg().catch(() => null);
  const advisors = await getChannelAdvisors().catch(() => []);
  const tests = orgId ? await getAbTests(orgId).catch(() => []) : [];

  return <AbTestClient advisors={advisors} tests={tests} />;
}
