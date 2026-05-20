import { db } from "@/db";
import { missionTasks, missions, aiEmployees } from "@/db/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";

export interface PendingApproval {
  stepId: string;
  workflowInstanceId: string;
  workflowName: string;
  stepLabel: string;
  teamId?: string;
  teamName?: string;
  employeeSlug?: string;
  employeeNickname?: string;
  outputPreview?: string;
  createdAt: string;
}

export interface ApprovalStats {
  pending: number;
  approvedToday: number;
  rejectedToday: number;
  timedOut: number;
}

export interface ApprovalHistoryItem {
  stepId: string;
  workflowName: string;
  stepLabel: string;
  teamName?: string;
  employeeSlug?: string;
  employeeNickname?: string;
  status: string;
  completedAt?: string;
}

export async function getPendingApprovals(
  orgId: string
): Promise<PendingApproval[]> {
  if (!orgId) return [];

  const rows = await db
    .select({
      stepId: missionTasks.id,
      missionId: missionTasks.missionId,
      taskTitle: missionTasks.title,
      taskOutput: missionTasks.outputSummary,
      employeeSlug: aiEmployees.slug,
      employeeNickname: aiEmployees.nickname,
      missionTitle: missions.title,
      createdAt: missionTasks.createdAt,
    })
    .from(missionTasks)
    .innerJoin(missions, eq(missionTasks.missionId, missions.id))
    .leftJoin(aiEmployees, eq(missionTasks.assignedEmployeeId, aiEmployees.id))
    .where(
      and(
        eq(missionTasks.status, "in_review"),
        eq(missions.organizationId, orgId),
      )
    )
    .orderBy(desc(missionTasks.createdAt));

  return rows.map((r) => ({
    stepId: r.stepId,
    workflowInstanceId: r.missionId,
    workflowName: r.missionTitle,
    stepLabel: r.taskTitle,
    employeeSlug: r.employeeSlug ?? undefined,
    employeeNickname: r.employeeNickname ?? undefined,
    outputPreview: r.taskOutput ?? undefined,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getApprovalStats(
  orgId: string
): Promise<ApprovalStats> {
  if (!orgId) return { pending: 0, approvedToday: 0, rejectedToday: 0, timedOut: 0 };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [pendingRow, approvedRow, rejectedRow] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(missionTasks)
      .innerJoin(missions, eq(missionTasks.missionId, missions.id))
      .where(
        and(
          eq(missionTasks.status, "in_review"),
          eq(missions.organizationId, orgId),
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(missionTasks)
      .innerJoin(missions, eq(missionTasks.missionId, missions.id))
      .where(
        and(
          eq(missionTasks.status, "completed"),
          eq(missions.organizationId, orgId),
          sql`(${missionTasks.outputData}->>'_reviewed')::text = 'true'`,
          sql`(${missionTasks.outputData}->>'_reviewAction')::text = 'approved'`,
          gte(missionTasks.completedAt, todayStart),
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(missionTasks)
      .innerJoin(missions, eq(missionTasks.missionId, missions.id))
      .where(
        and(
          eq(missionTasks.status, "failed"),
          eq(missions.organizationId, orgId),
          sql`(${missionTasks.outputData}->>'_reviewed')::text = 'true'`,
          sql`(${missionTasks.outputData}->>'_reviewAction')::text = 'rejected'`,
          gte(missionTasks.completedAt, todayStart),
        )
      ),
  ]);

  return {
    pending: Number(pendingRow[0]?.count ?? 0),
    approvedToday: Number(approvedRow[0]?.count ?? 0),
    rejectedToday: Number(rejectedRow[0]?.count ?? 0),
    timedOut: 0,
  };
}

export async function getApprovalHistory(
  orgId: string,
  limit = 20
): Promise<ApprovalHistoryItem[]> {
  if (!orgId) return [];

  const rows = await db
    .select({
      stepId: missionTasks.id,
      missionTitle: missions.title,
      taskTitle: missionTasks.title,
      employeeSlug: aiEmployees.slug,
      employeeNickname: aiEmployees.nickname,
      taskStatus: missionTasks.status,
      completedAt: missionTasks.completedAt,
    })
    .from(missionTasks)
    .innerJoin(missions, eq(missionTasks.missionId, missions.id))
    .leftJoin(aiEmployees, eq(missionTasks.assignedEmployeeId, aiEmployees.id))
    .where(
      and(
        eq(missions.organizationId, orgId),
        sql`(${missionTasks.outputData}->>'_reviewed')::text = 'true'`,
      )
    )
    .orderBy(desc(missionTasks.completedAt))
    .limit(limit);

  return rows.map((r) => ({
    stepId: r.stepId,
    workflowName: r.missionTitle,
    stepLabel: r.taskTitle,
    employeeSlug: r.employeeSlug ?? undefined,
    employeeNickname: r.employeeNickname ?? undefined,
    status: r.taskStatus,
    completedAt: r.completedAt?.toISOString(),
  }));
}
