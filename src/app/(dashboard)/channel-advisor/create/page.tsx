export const dynamic = "force-dynamic";

/**
 * @hidden 渠道顾问 — 模块已解耦暂不开放，如需恢复请在侧边栏添加入口。
 * 如需修改请先确认不影响活跃模块后再操作。
 */

import { getKnowledgeSources } from "@/lib/dal/channel-advisors";
import CreateAdvisorClient from "./create-advisor-client";

export default async function CreateAdvisorPage() {
  const knowledgeSources = await getKnowledgeSources().catch(() => ({ upload: [], cms: [], subscription: [], stats: { totalDocuments: 0, totalChunks: 0, lastSync: "" } }));
  return <CreateAdvisorClient knowledgeSources={knowledgeSources} />;
}
