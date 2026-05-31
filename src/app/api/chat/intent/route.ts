import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  aiEmployees,
  workflowTemplates,
  organizations,
  userProfiles,
  employeeSkills,
  skills,
  intentLogs,
} from "@/db/schema";
import { and, eq, desc, inArray, asc, or, sql } from "drizzle-orm";
import {
  recognizeIntent,
  type IntentResult,
  type IntentMemoryEntry,
  type ScenarioInfo,
} from "@/lib/agent/intent-recognition";
import { isLeaderSlug } from "@/lib/agent/mulan-router";
import { buildEmployeeVisibilityCondition } from "@/lib/dal/visibility-filter";
import { isSuperAdmin } from "@/lib/rbac";

interface EmployeeSkillInfo {
  slug: string;
  name: string;
  nickname: string;
  title: string;
  skills: string[];
}

async function resolveOrgId(userId: string | null): Promise<string | null> {
  if (userId) {
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, userId),
    });
    if (profile?.organizationId) return profile.organizationId;
  }
  const defaultOrg = await db.query.organizations.findFirst({
    orderBy: asc(organizations.createdAt),
  });
  return defaultOrg?.id ?? null;
}

export async function POST(req: Request) {
  let userId: string | null = null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  userId = user?.id ?? null;
  const admin = userId ? await isSuperAdmin(userId) : false;

  let body: { message?: unknown; employeeSlug?: unknown; clarifiedParameters?: unknown; clarificationHistory?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const message = String(body.message || "").trim();
  if (!message) {
    return new Response("消息内容不能为空", { status: 400 });
  }
  const employeeSlug = typeof body.employeeSlug === "string" ? body.employeeSlug : undefined;
  const clarifiedParameters =
    body.clarifiedParameters &&
    typeof body.clarifiedParameters === "object" &&
    !Array.isArray(body.clarifiedParameters)
      ? body.clarifiedParameters as Record<string, string>
      : undefined;
  const clarificationHistory =
    body.clarificationHistory &&
    Array.isArray(body.clarificationHistory)
      ? body.clarificationHistory as Array<{ question: string; answer: string }>
      : undefined;

  try {
    const orgId = await resolveOrgId(userId);
    const empRows = orgId
      ? await db.query.aiEmployees.findMany({
          where: userId
            ? buildEmployeeVisibilityCondition({
                userId,
                orgId,
                table: aiEmployees,
                isAdmin: admin,
              })
            : eq(aiEmployees.organizationId, orgId),
        })
      : [];

    const seen = new Set<string>();
    const uniqueEmps = empRows.filter((r) => {
      if (seen.has(r.slug)) return false;
      seen.add(r.slug);
      return true;
    });

    const empIds = uniqueEmps.map((e) => e.id);
    const allSkillRows = empIds.length > 0
      ? await db
          .select({ employeeId: employeeSkills.employeeId, skillName: skills.name })
          .from(employeeSkills)
          .innerJoin(skills, eq(employeeSkills.skillId, skills.id))
          .where(inArray(employeeSkills.employeeId, empIds))
      : [];

    const skillsByEmp = new Map<string, string[]>();
    for (const row of allSkillRows) {
      const list = skillsByEmp.get(row.employeeId) || [];
      list.push(row.skillName);
      skillsByEmp.set(row.employeeId, list);
    }

    const availableEmployees: EmployeeSkillInfo[] = uniqueEmps.map((e) => ({
      slug: e.slug,
      name: e.name,
      nickname: e.nickname ?? "",
      title: e.title ?? "",
      skills: skillsByEmp.get(e.id) || [],
    }));

    const scenarioRows = orgId
      ? await db.query.workflowTemplates.findMany({
          where: and(
            eq(workflowTemplates.organizationId, orgId),
            eq(workflowTemplates.isEnabled, true),
            admin
              ? sql`true`
              : or(
                  eq(workflowTemplates.isBuiltin, true),
                  eq(workflowTemplates.isPublic, true),
                  userId ? eq(workflowTemplates.createdBy, userId) : sql`false`,
                ),
          ),
          limit: 50,
        })
      : [];

    const availableScenarios: ScenarioInfo[] = scenarioRows.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      category: s.category,
      defaultTeam: Array.isArray(s.defaultTeam) ? s.defaultTeam as string[] : [],
    }));

    const recentLogs = userId
      ? await db
          .select({
            userMessage: intentLogs.userMessage,
            intentType: intentLogs.intentType,
            intentResult: intentLogs.intentResult,
            userEdited: intentLogs.userEdited,
          })
          .from(intentLogs)
          .where(eq(intentLogs.userId, userId))
          .orderBy(desc(intentLogs.createdAt))
          .limit(5)
      : [];

    const userMemories: IntentMemoryEntry[] = recentLogs.map((log) => {
      const result = log.intentResult as IntentResult | null;
      return {
        userMessage: log.userMessage,
        intentType: log.intentType,
        skills: result?.steps?.flatMap((s) => s.skills) ?? [],
        userEdited: log.userEdited,
      };
    });

    const isLeader = isLeaderSlug(employeeSlug || "leader");

    const intentResult = await recognizeIntent(
      message,
      employeeSlug || uniqueEmps[0]?.slug || "mulan",
      availableEmployees,
      userMemories,
      clarifiedParameters,
      clarificationHistory,
      availableScenarios,
    );

    console.log("[chat/intent] RESULT: type=", intentResult.intentType, "conf=", intentResult.confidence, "steps=", intentResult.steps?.length, "needsCl=", intentResult.needsClarification);

    if (userId && orgId && intentResult.intentType !== "general_chat") {
      await db.insert(intentLogs).values({
        organizationId: orgId,
        userId,
        employeeSlug: employeeSlug || uniqueEmps[0]?.slug || "mulan",
        userMessage: message,
        intentType: intentResult.intentType,
        intentResult: intentResult as unknown as Record<string, unknown>,
        userEdited: false,
      });
    }

    return Response.json(intentResult);
  } catch (err) {
    console.error("[chat/intent] Unhandled error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
