import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { missions } from "@/db/schema/missions";
import { userProfiles } from "@/db/schema/users";
import { desc, eq } from "drizzle-orm";
import { MulanMissionsClient } from "./mulan-missions-client";

export const dynamic = "force-dynamic";

export default async function MulanMissionsPage() {
  let missionList: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    progress: number | null;
  }> = [];

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const profile = await db
        .select({ organizationId: userProfiles.organizationId })
        .from(userProfiles)
        .where(eq(userProfiles.id, user.id))
        .limit(1);

      const orgId = profile[0]?.organizationId;
      if (orgId) {
        const rows = await db
          .select({
            id: missions.id,
            title: missions.title,
            status: missions.status,
            createdAt: missions.createdAt,
            progress: missions.progress,
          })
          .from(missions)
          .where(eq(missions.organizationId, orgId))
          .orderBy(desc(missions.createdAt))
          .limit(50);

        missionList = rows.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
        }));
      }
    }
  } catch (err) {
    console.error("[mulan-missions] load failed:", err);
  }

  return <MulanMissionsClient missions={missionList} />;
}
