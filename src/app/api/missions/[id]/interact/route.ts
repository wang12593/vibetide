import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { missions, missionTasks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resumePausedTask } from "@/lib/mission-executor";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await getCurrentUserAndOrg();
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: missionId } = await params;

  const mission = await db.query.missions.findFirst({
    where: eq(missions.id, missionId),
    columns: { id: true, organizationId: true },
  });
  if (!mission || mission.organizationId !== authResult.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { taskId?: string; userInput?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.taskId || !body.userInput) {
    return NextResponse.json(
      { error: "Missing taskId or userInput" },
      { status: 400 }
    );
  }

  const task = await db.query.missionTasks.findFirst({
    where: and(
      eq(missionTasks.id, body.taskId),
      eq(missionTasks.missionId, missionId),
      eq(missionTasks.status, "paused")
    ),
  });

  if (!task) {
    return NextResponse.json(
      { error: "Paused task not found" },
      { status: 404 }
    );
  }

  try {
    const result = await resumePausedTask(body.taskId, missionId, body.userInput);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Resume failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await getCurrentUserAndOrg();
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: missionId } = await params;

  const mission = await db.query.missions.findFirst({
    where: eq(missions.id, missionId),
    columns: { id: true, organizationId: true },
  });
  if (!mission || mission.organizationId !== authResult.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pausedTasks = await db
    .select({
      id: missionTasks.id,
      title: missionTasks.title,
      pauseReason: missionTasks.pauseReason,
      pendingInputFields: missionTasks.pendingInputFields,
      progress: missionTasks.progress,
    })
    .from(missionTasks)
    .where(
      and(
        eq(missionTasks.missionId, missionId),
        eq(missionTasks.status, "paused")
      )
    );

  return NextResponse.json({ pausedTasks });
}
