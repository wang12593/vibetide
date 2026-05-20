"use server";

import { requireAuth, requireCurrentOrgId } from "@/lib/demo-auth";
import { db } from "@/db";
import { missions, aiEmployees, workflowTemplates } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getOrProvisionLeader } from "./missions";
import { executeMissionDirect } from "@/lib/mission-executor";
import type { IntentResult } from "@/lib/agent/types";

export async function startMissionFromChat(
  userMessage: string,
  intentResult: IntentResult,
): Promise<{ missionId: string; status: string }> {
  await requireAuth();
  const orgId = await requireCurrentOrgId();

  const leader = await getOrProvisionLeader(orgId);

  if (
    intentResult.executionMode === "workflow" &&
    intentResult.workflowId
  ) {
    const template = await db.query.workflowTemplates.findFirst({
      where: and(
        eq(workflowTemplates.id, intentResult.workflowId),
        eq(workflowTemplates.organizationId, orgId),
      ),
    });

    if (template) {
      const defaultTeamSlugs = Array.isArray(template.defaultTeam)
        ? (template.defaultTeam as string[])
        : [];
      const teamEmployeeIds: string[] = defaultTeamSlugs.length
        ? (
            await db
              .select({ id: aiEmployees.id })
              .from(aiEmployees)
              .where(
                and(
                  eq(aiEmployees.organizationId, orgId),
                  inArray(aiEmployees.slug, defaultTeamSlugs),
                ),
              )
          ).map((r) => r.id)
        : [];

      const [mission] = await db
        .insert(missions)
        .values({
          organizationId: orgId,
          title: template.name,
          scenario: template.name,
          userInstruction: userMessage,
          leaderEmployeeId: leader.id,
          workflowTemplateId: template.id,
          teamMembers: teamEmployeeIds,
          status: "queued",
          sourceModule: "chat",
          inputParams: {
            intentType: intentResult.intentType,
            steps: intentResult.steps,
            ...intentResult.userInputs,
          },
          tokenBudget: 200000,
        })
        .returning();

      if (!mission) {
        throw new Error("Failed to create mission");
      }

      await db
        .update(workflowTemplates)
        .set({
          lastRunAt: new Date(),
          runCount: sql`${workflowTemplates.runCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(workflowTemplates.id, template.id))
        .catch(() => {});

      executeMissionDirect(mission.id, orgId).catch((err) => {
        console.error("[startMissionFromChat/wf] Mission execution failed:", err);
      });

      return { missionId: mission.id, status: "queued" };
    }
  }

  const teamSlugs = [
    ...new Set(intentResult.steps.map((s) => s.employeeSlug)),
  ];

  const teamEmployees = await db
    .select()
    .from(aiEmployees)
    .where(
      and(
        eq(aiEmployees.organizationId, orgId),
        inArray(aiEmployees.slug, teamSlugs),
      ),
    );

  const teamEmployeeIds = teamEmployees.map((e) => e.id);

  const [mission] = await db
    .insert(missions)
    .values({
      organizationId: orgId,
      title: intentResult.summary || userMessage.slice(0, 80),
      scenario: "custom",
      userInstruction: userMessage,
      leaderEmployeeId: leader.id,
      teamMembers: teamEmployeeIds,
      status: "queued",
      sourceModule: "chat",
      inputParams: {
        intentType: intentResult.intentType,
        steps: intentResult.steps,
      },
      tokenBudget: 200000,
    })
    .returning();

  if (!mission) {
    throw new Error("Failed to create mission");
  }

  executeMissionDirect(mission.id, orgId).catch((err) => {
    console.error("[startMissionFromChat] Mission execution failed:", err);
  });

  return { missionId: mission.id, status: "queued" };
}
