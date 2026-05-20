"use server";

import { db } from "@/db";
import { aiEmployees, missionTasks, missionMessages } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { WORK_PREFERENCE_TEMPLATES } from "@/lib/constants";
import { requireAuth, requireCurrentOrgId } from "@/lib/demo-auth";

export async function applyWorkPreferenceTemplate(
  employeeId: string,
  templateKey: string
) {
  await requireAuth();

  const template =
    WORK_PREFERENCE_TEMPLATES[
      templateKey as keyof typeof WORK_PREFERENCE_TEMPLATES
    ];
  if (!template) {
    throw new Error(`未知的偏好模板: ${templateKey}`);
  }

  await db
    .update(aiEmployees)
    .set({
      workPreferences: {
        proactivity: template.preferences.proactivity,
        reportingFrequency: template.preferences.reportingFrequency,
        autonomyLevel: template.preferences.autonomyLevel,
        communicationStyle: template.preferences.communicationStyle,
        workingHours: template.preferences.workingHours,
      },
      updatedAt: new Date(),
    })
    .where(eq(aiEmployees.id, employeeId));

  revalidatePath("/employee");
  revalidatePath("/approvals");
}

export async function reviewTaskApproval(
  taskId: string,
  status: "completed" | "failed",
  feedback?: string,
) {
  await requireAuth();
  const orgId = await requireCurrentOrgId();

  const task = await db.query.missionTasks.findFirst({
    where: and(
      eq(missionTasks.id, taskId),
      eq(missionTasks.status, "in_review"),
    ),
    with: {
      mission: { columns: { organizationId: true, leaderEmployeeId: true } },
    },
  });

  if (!task || task.mission.organizationId !== orgId) {
    throw new Error("任务不存在或无权操作");
  }

  await db
    .update(missionTasks)
    .set({
      status,
      outputSummary: feedback || null,
      completedAt: new Date(),
      outputData: {
        ...(task.outputData ?? {}),
        _reviewed: true,
        _reviewAction: status === "completed" ? "approved" : "rejected",
      },
    })
    .where(eq(missionTasks.id, taskId));

  await db.insert(missionMessages).values({
    missionId: task.missionId,
    fromEmployeeId: task.mission.leaderEmployeeId,
    messageType: "status_update",
    content:
      status === "completed"
        ? `人工审批通过${feedback ? `：${feedback}` : ""}`
        : `人工审批驳回${feedback ? `：${feedback}` : ""}`,
    channel: "system",
    relatedTaskId: taskId,
    structuredData: {
      reviewAction: status === "completed" ? "approved" : "rejected",
      feedback: feedback || null,
    },
  });

  revalidatePath("/approvals");
}

export async function batchReviewTaskApprovals(
  taskIds: string[],
  status: "completed" | "failed",
  feedback?: string,
) {
  await requireAuth();
  const orgId = await requireCurrentOrgId();

  const tasks = await db.query.missionTasks.findMany({
    where: and(
      eq(missionTasks.status, "in_review"),
    ),
    with: {
      mission: { columns: { organizationId: true, leaderEmployeeId: true } },
    },
  });

  const orgTasks = tasks.filter(
    (t) => t.mission.organizationId === orgId && taskIds.includes(t.id),
  );

  for (const task of orgTasks) {
    await db
      .update(missionTasks)
      .set({
        status,
        outputSummary: feedback || null,
        completedAt: new Date(),
        outputData: {
          ...(task.outputData ?? {}),
          _reviewed: true,
          _reviewAction: status === "completed" ? "approved" : "rejected",
        },
      })
      .where(eq(missionTasks.id, task.id));

    await db.insert(missionMessages).values({
      missionId: task.missionId,
      fromEmployeeId: task.mission.leaderEmployeeId,
      messageType: "status_update",
      content:
        status === "completed"
          ? `人工审批通过${feedback ? `：${feedback}` : ""}`
          : `人工审批驳回${feedback ? `：${feedback}` : ""}`,
      channel: "system",
      relatedTaskId: task.id,
      structuredData: {
        reviewAction: status === "completed" ? "approved" : "rejected",
        feedback: feedback || null,
      },
    });
  }

  revalidatePath("/approvals");
}
