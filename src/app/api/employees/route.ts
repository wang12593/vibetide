import { NextResponse } from "next/server";
import { getEmployees } from "@/lib/dal/employees";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const admin = user ? await isSuperAdmin(user.id) : false;
    const [employees, orgId] = await Promise.all([
      getEmployees(user ? { userId: user.id, isAdmin: admin } : undefined),
      getCurrentUserOrg(),
    ]);
    return NextResponse.json({ employees, organizationId: orgId || "" });
  } catch (error) {
    console.error("[api/employees] failed:", error);
    return NextResponse.json(
      { employees: [], organizationId: "", error: "数据加载失败" },
      { status: 500 }
    );
  }
}
