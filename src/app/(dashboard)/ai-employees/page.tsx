export const dynamic = "force-dynamic";

import { getEmployees } from "@/lib/dal/employees";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/rbac";
import { AiEmployeesClient } from "./ai-employees-client";

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 15000): Promise<T> {
  return Promise.race([
    promise.catch((err) => { console.error("[ai-employees] withTimeout failed:", err); return fallback; }),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export default async function AiEmployeesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = user ? await isSuperAdmin(user.id) : false;

  const [employees, orgId] = await Promise.all([
    withTimeout(getEmployees(user ? { userId: user.id, isAdmin: admin } : undefined), []),
    withTimeout(getCurrentUserOrg(), null),
  ]);

  return <AiEmployeesClient employees={employees} organizationId={orgId || ""} />;
}
