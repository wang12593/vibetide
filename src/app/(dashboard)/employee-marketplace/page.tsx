export const dynamic = "force-dynamic";

/**
 * @hidden 员工市场 — 模块已解耦暂不开放，如需恢复请在侧边栏添加入口。
 * 如需修改请先确认不影响活跃模块后再操作。
 */

import { getEmployees } from "@/lib/dal/employees";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/rbac";
import { EmployeeMarketplaceClient } from "./employee-marketplace-client";

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 15000): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export default async function EmployeeMarketplacePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = user ? await isSuperAdmin(user.id) : false;

  const [employees, orgId] = await Promise.all([
    withTimeout(getEmployees(user ? { userId: user.id, isAdmin: admin } : undefined), []),
    withTimeout(getCurrentUserOrg(), null),
  ]);

  return (
    <EmployeeMarketplaceClient
      employees={employees}
      organizationId={orgId || ""}
    />
  );
}
