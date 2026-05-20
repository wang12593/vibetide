"use server";

import { db } from "@/db";
import { missions, missionTasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/demo-auth";

export async function getMissionResult(missionId: string) {
  await requireAuth();

  const mission = await db.query.missions.findFirst({
    where: eq(missions.id, missionId),
  });

  if (!mission) return null;

  const tasks = await db
    .select({
      id: missionTasks.id,
      title: missionTasks.title,
      status: missionTasks.status,
      progress: missionTasks.progress,
      outputData: missionTasks.outputData,
    })
    .from(missionTasks)
    .where(eq(missionTasks.missionId, missionId));

  return {
    id: mission.id,
    title: mission.title,
    status: mission.status,
    progress: mission.progress,
    finalOutput: mission.finalOutput,
    tasks,
  };
}
