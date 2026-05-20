import { getCurrentUserProfile } from "@/lib/dal/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const hasAdminAccess =
    profile.isSuperAdmin ||
    profile.permissions.includes("system:manage_users") ||
    profile.permissions.includes("system:manage_orgs") ||
    profile.permissions.includes("system:manage_roles") ||
    profile.permissions.includes("content:view_all");

  if (!hasAdminAccess) redirect("/home");

  return <>{children}</>;
}
