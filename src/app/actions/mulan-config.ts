"use server";

import { requireAuth } from "@/lib/demo-auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { getSkillsNotBoundToEmployee } from "@/lib/dal/skills";
import { getKnowledgeBasesNotBoundToEmployee } from "@/lib/dal/knowledge-bases";
import {
  bindSkillToEmployee,
  unbindSkillFromEmployee,
  bindKnowledgeBaseToEmployee,
  unbindKnowledgeBaseFromEmployee,
} from "@/app/actions/employees";
import { db } from "@/db";
import { workflowTemplates } from "@/db/schema/workflows";
import { userAiPreferences } from "@/db/schema/user-ai-preferences";
import { eq, and, isNull, notInArray, sql } from "drizzle-orm";

export async function getUnboundSkills(employeeId: string) {
  await requireAuth();
  return getSkillsNotBoundToEmployee(employeeId);
}

export async function getUnboundKnowledgeBases(employeeId: string) {
  await requireAuth();
  return getKnowledgeBasesNotBoundToEmployee(employeeId);
}

export async function getUnboundWorkflows() {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return [];
  const rows = await db
    .select({ id: workflowTemplates.id, name: workflowTemplates.name, steps: workflowTemplates.steps })
    .from(workflowTemplates)
    .where(
      and(
        eq(workflowTemplates.organizationId, orgId),
        eq(workflowTemplates.isEnabled, true),
        isNull(workflowTemplates.ownerEmployeeId),
      ),
    );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    stepCount: Array.isArray(r.steps) ? r.steps.length : 0,
  }));
}

export async function addWorkflowToMulan(workflowId: string) {
  await requireAuth();
  await db
    .update(workflowTemplates)
    .set({ ownerEmployeeId: "leader" })
    .where(eq(workflowTemplates.id, workflowId));
}

export async function removeWorkflowFromMulan(workflowId: string) {
  await requireAuth();
  await db
    .update(workflowTemplates)
    .set({ ownerEmployeeId: null })
    .where(eq(workflowTemplates.id, workflowId));
}

export async function addSkill(employeeId: string, skillId: string) {
  await requireAuth();
  await bindSkillToEmployee(employeeId, skillId, 50, "extended");
}

export async function removeSkill(employeeId: string, skillId: string) {
  await requireAuth();
  await unbindSkillFromEmployee(employeeId, skillId);
}

export async function addKnowledgeBase(employeeId: string, kbId: string) {
  await requireAuth();
  await bindKnowledgeBaseToEmployee(employeeId, kbId);
}

export async function removeKnowledgeBase(employeeId: string, kbId: string) {
  await requireAuth();
  await unbindKnowledgeBaseFromEmployee(employeeId, kbId);
}

export async function getMulanDisabledEmployees(): Promise<string[]> {
  await requireAuth();
  const rows = await db
    .select({ metadata: userAiPreferences.metadata })
    .from(userAiPreferences)
    .limit(1);
  const meta = rows[0]?.metadata as Record<string, unknown> | null;
  const list = (meta?.mulanDisabledEmployees as string[]) ?? [];
  return list;
}

export async function setMulanEmployeeEnabled(employeeSlug: string, enabled: boolean) {
  await requireAuth();
  const rows = await db
    .select({ id: userAiPreferences.id, metadata: userAiPreferences.metadata })
    .from(userAiPreferences)
    .limit(1);

  const meta = (rows[0]?.metadata as Record<string, unknown>) ?? {};
  const current = new Set((meta.mulanDisabledEmployees as string[]) ?? []);

  if (enabled) {
    current.delete(employeeSlug);
  } else {
    current.add(employeeSlug);
  }

  const updated = { ...meta, mulanDisabledEmployees: [...current] };

  if (rows.length > 0) {
    await db
      .update(userAiPreferences)
      .set({ metadata: updated, updatedAt: new Date() })
      .where(eq(userAiPreferences.id, rows[0].id));
  } else {
    const user = await requireAuth();
    const orgId = await getCurrentUserOrg();
    await db.insert(userAiPreferences).values({
      userId: user.id,
      organizationId: orgId!,
      metadata: updated,
    });
  }
}
