export const dynamic = "force-dynamic";

/**
 * @hidden 超级创作 — 模块已解耦暂不开放，如需恢复请在侧边栏添加入口。
 * 如需修改请先确认不影响活跃模块后再操作。
 */

import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  getActiveCreationGoal,
  getCreationTasks,
  getCreationChatMessages,
} from "@/lib/dal/creation";
import { SuperCreationClient } from "./super-creation-client";

export default async function SuperCreationPage() {
  let goal: Awaited<ReturnType<typeof getActiveCreationGoal>> | null = null;
  let tasks: Awaited<ReturnType<typeof getCreationTasks>> = [];
  let chatHistory: Awaited<ReturnType<typeof getCreationChatMessages>> = [];

  try {
    const orgId = await getCurrentUserOrg();
    if (orgId) {
      goal = await getActiveCreationGoal(orgId);
      if (goal) {
        [tasks, chatHistory] = await Promise.all([
          getCreationTasks(goal.id),
          getCreationChatMessages(goal.id),
        ]);
      }
    }
  } catch {
    // Gracefully degrade when DB is unavailable
  }

  return (
    <SuperCreationClient
      goal={goal}
      tasks={tasks}
      chatHistory={chatHistory}
    />
  );
}
