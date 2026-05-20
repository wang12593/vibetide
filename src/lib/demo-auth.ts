import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { asc } from "drizzle-orm";

async function getDefaultOrgId(): Promise<string> {
  const org = await db.query.organizations.findFirst({
    orderBy: asc(organizations.createdAt),
  });
  if (!org) throw new Error("No organization found");
  return org.id;
}

export async function requireAuth() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) return user;
  } catch {
    // Supabase unavailable
  }

  if (process.env.NODE_ENV === "production" && process.env.VIBETIDE_DEMO_MODE !== "true") {
    throw new Error("Authentication required");
  }

  return { id: "00000000-0000-0000-0000-000000000000", email: "demo@vibetide.local" } as Awaited<
    ReturnType<typeof createClient>
  > extends {
    auth: { getUser(): Promise<{ data: { user: infer U } }> };
  }
    ? NonNullable<U>
    : never;
}

export async function requireCurrentOrgId(): Promise<string> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { getCurrentUserOrg } = await import("@/lib/dal/auth");
      const orgId = await getCurrentUserOrg();
      if (orgId) return orgId;
    }
  } catch {
    // Supabase unavailable
  }

  if (process.env.NODE_ENV === "production" && process.env.VIBETIDE_DEMO_MODE !== "true") {
    throw new Error("Authentication required");
  }

  return getDefaultOrgId();
}
