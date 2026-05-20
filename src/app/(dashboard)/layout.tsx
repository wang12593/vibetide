import { getUnreadCount } from "@/lib/dal/notifications";
import { getCurrentUserProfile } from "@/lib/dal/auth";
import { PermissionProvider } from "@/components/providers/permission-provider";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Toaster } from "sonner";
import { db } from "@/db";
import { missions } from "@/db/schema/missions";
import { savedConversations } from "@/db/schema/saved-conversations";
import { desc, eq } from "drizzle-orm";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let displayName = "演示用户";
  let unreadCount = 0;
  let permissions: string[] = [];
  let superAdmin = false;
  let recentMissions: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    progress: number | null;
  }> = [];
  let recentConversations: Array<{
    id: string;
    title: string;
    updatedAt: string;
  }> = [];

  try {
    const profile = await Promise.race([
      getCurrentUserProfile(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);

    if (profile) {
      displayName = profile.displayName;
      permissions = profile.permissions;
      superAdmin = profile.isSuperAdmin;

      try {
        unreadCount = await getUnreadCount(
          profile.organizationId,
          profile.userId
        );
      } catch (error) { console.warn("获取未读消息数失败:", error); }

      try {
        const [missionRows, convRows] = await Promise.all([
          db
            .select({ id: missions.id, title: missions.title, status: missions.status, createdAt: missions.createdAt, progress: missions.progress })
            .from(missions)
            .where(eq(missions.organizationId, profile.organizationId))
            .orderBy(desc(missions.createdAt))
            .limit(5),
          db
            .select({ id: savedConversations.id, title: savedConversations.title, updatedAt: savedConversations.updatedAt })
            .from(savedConversations)
            .where(eq(savedConversations.employeeSlug, "leader"))
            .orderBy(desc(savedConversations.updatedAt))
            .limit(5),
        ]);
        recentMissions = missionRows.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }));
        recentConversations = convRows.map((c) => ({ ...c, updatedAt: c.updatedAt.toISOString() }));
      } catch (error) { console.warn("获取用户信息失败:", error); }
    }
  } catch {
    // Supabase unavailable — allow demo access
  }

  return (
    <PermissionProvider permissions={permissions} isSuperAdmin={superAdmin}>
      <DashboardShell
        userName={displayName}
        unreadCount={unreadCount}
        permissions={permissions}
        recentMissions={recentMissions}
        recentConversations={recentConversations}
      >
        {children}
      </DashboardShell>
      <Toaster position="top-center" richColors />
    </PermissionProvider>
  );
}
