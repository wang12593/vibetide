/**
 * @hidden 选题比对 — 模块已解耦暂不开放，如需恢复请在侧边栏添加入口。
 * 如需修改请先确认不影响活跃模块后再操作。
 */

import { getCurrentUserOrg } from "@/lib/dal/auth";
import { listMyAccounts, type MyAccountRow } from "@/lib/dal/my-accounts";
import { MyAccountsClient } from "./my-accounts-client";

export const dynamic = "force-dynamic";

export default async function MyAccountsPage() {
  let rows: MyAccountRow[] = [];
  try {
    const orgId = await getCurrentUserOrg();
    if (orgId) rows = await listMyAccounts(orgId);
  } catch (err) {
    console.error("[my-accounts] 加载失败:", err);
  }
  return <MyAccountsClient rows={rows} />;
}
