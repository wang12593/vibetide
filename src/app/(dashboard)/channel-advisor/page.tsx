export const dynamic = "force-dynamic";

/**
 * @hidden 渠道顾问 — 模块已解耦暂不开放，如需恢复请在侧边栏添加入口。
 * 如需修改请先确认不影响活跃模块后再操作。
 */

import { getChannelAdvisors } from "@/lib/dal/channel-advisors";
import ChannelAdvisorClient from "./channel-advisor-client";

export default async function ChannelAdvisorPage() {
  const advisors = await getChannelAdvisors().catch(() => []);
  return <ChannelAdvisorClient advisors={advisors} />;
}
