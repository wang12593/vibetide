/**
 * @hidden 积分排行 — 模块已解耦暂不开放，如需恢复请在侧边栏添加入口。
 * 如需修改请先确认不影响活跃模块后再操作。
 */

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  getEditorLeaderboard,
  getEditorScore,
  getPointTransactions,
} from "@/lib/dal/editor-scores";
import LeaderboardClient from "./leaderboard-client";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  let user: { id: string } | null = null;
  let orgId: string | null = null;

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
    orgId = await getCurrentUserOrg();
  } catch {
    // Gracefully degrade when auth is unavailable
  }

  const leaderboard = orgId ? await getEditorLeaderboard(orgId).catch(() => []) : [];
  const currentUser = orgId && user ? await getEditorScore(user.id, orgId).catch(() => null) : null;
  const transactions =
    orgId && user ? await getPointTransactions(user.id, orgId).catch(() => []) : [];

  return (
    <LeaderboardClient
      leaderboard={leaderboard}
      currentUser={currentUser}
      transactions={transactions}
    />
  );
}
