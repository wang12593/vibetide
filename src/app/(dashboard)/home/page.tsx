import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { missions } from "@/db/schema/missions";
import { savedConversations } from "@/db/schema/saved-conversations";
import { desc, eq, or, and, sql, inArray } from "drizzle-orm";
import { getEmployees } from "@/lib/dal/employees";
import { getCurrentUserProfile } from "@/lib/dal/auth";
import { getSkillsWithBindCount } from "@/lib/dal/skills";
import { getEmployeeKnowledgeBases } from "@/lib/dal/knowledge-bases";
import { listTemplatesForHomepageByTab } from "@/lib/dal/workflow-templates-listing";
import type { WorkflowTemplateRow } from "@/db/types";
import { getMulanDisabledEmployees } from "@/app/actions/mulan-config";
import { getAllBuiltinSkills } from "@/lib/skill-loader";
import { isSuperAdmin } from "@/lib/rbac";
import { HomeClient } from "./home-client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
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
  let dispatchableEmployees: Array<{
    id: string;
    dbId: string;
    name: string;
    nickname: string;
    status: string;
  }> = [];
  let mulanDbId = "";
  let userName = "用户";
  let disabledEmployeeSlugs: string[] = [];
  let mulanSkills: Array<{
    id: string;
    name: string;
    category: string;
    bindingType?: string;
  }> = [];
  let mulanKnowledgeBases: Array<{
    id: string;
    name: string;
    documentCount: number;
  }> = [];
  let mulanWorkflows: (WorkflowTemplateRow & { __homepagePinnedAt?: Date | null })[] = [];
  let builtinSkills: Array<{ slug: string; name: string; category: string; description: string }> = [];
  let customSkills: Array<{ id: string; name: string; category: string; description: string; content?: string }> = [];

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      let orgId: string | undefined;
      const admin = await isSuperAdmin(user.id);

      try {
        const profile = await getCurrentUserProfile();
        if (profile) {
          userName = profile.displayName;
          orgId = profile.organizationId;
        }
      } catch (err) {
        console.error("[home] data load failed:", err);
      }

      const [missionsResult, convsResult, employees] = await Promise.all([
        orgId
          ? db.select({
              id: missions.id,
              title: missions.title,
              status: missions.status,
              createdAt: missions.createdAt,
              progress: missions.progress,
            })
            .from(missions)
            .where(and(
              eq(missions.organizationId, orgId!),
              or(
                eq(missions.visibility, "org"),
                eq(missions.createdBy, user.id),
                sql`${missions.visibility} IS NULL`
              )
            ))
            .orderBy(desc(missions.createdAt))
            .limit(10)
          : Promise.resolve([]),
        db.select({
          id: savedConversations.id,
          title: savedConversations.title,
          updatedAt: savedConversations.updatedAt,
        })
          .from(savedConversations)
          .where(eq(savedConversations.employeeSlug, "leader"))
          .orderBy(desc(savedConversations.updatedAt))
          .limit(10),
        getEmployees({ userId: user.id, isAdmin: admin }),
      ]);

      try { disabledEmployeeSlugs = await getMulanDisabledEmployees(); } catch (err) { console.error("[home] data load failed:", err); }

      recentMissions = missionsResult.map((m) => ({
        ...m,
        createdAt: (m as { createdAt: Date }).createdAt.toISOString(),
      }));

      recentConversations = convsResult.map((c) => ({
        ...c,
        updatedAt: (c as { updatedAt: Date }).updatedAt.toISOString(),
      }));

      dispatchableEmployees = employees
        .filter((e) => e.id !== "leader" && e.id !== "advisor")
        .map((e) => ({
          id: e.id,
          dbId: e.dbId,
          name: e.name,
          nickname: e.nickname,
          status: e.status,
        }));

      const leaderEmployee = employees.find((e) => e.id === "leader");
      const [kbResult, wfResult] = await Promise.all([
        leaderEmployee ? getEmployeeKnowledgeBases(leaderEmployee.dbId).catch(() => []) : Promise.resolve([]),
        orgId ? listTemplatesForHomepageByTab(orgId, "leader", { userId: user.id, isAdmin: admin }).catch(() => []) : Promise.resolve([]),
      ]);

      if (leaderEmployee) {
        mulanDbId = leaderEmployee.dbId;
        mulanSkills = leaderEmployee.skills.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          bindingType: s.bindingType,
        }));
        mulanKnowledgeBases = kbResult.map((kb: { id: string; name: string; documentCount: number }) => ({
          id: kb.id,
          name: kb.name,
          documentCount: kb.documentCount,
        }));
      }

      mulanWorkflows = wfResult;

      try {
        builtinSkills = getAllBuiltinSkills().map((s) => ({
          slug: s.slug,
          name: s.name,
          category: s.category,
          description: s.description,
        }));
      } catch (err) {
        console.error("[home] builtin skills load failed:", err);
      }

      try {
        const allSkills = await getSkillsWithBindCount({ userId: user?.id, mode: "own" });
        const customRows = allSkills.filter((s) => s.type === "custom");
        const customIds = customRows.map((s) => s.id);
        const contentMap = new Map<string, string | null>();
        if (customIds.length > 0) {
          const { skills: skillsTable } = await import("@/db/schema/skills");
          const contentRows = await db.select({ id: skillsTable.id, content: skillsTable.content })
            .from(skillsTable)
            .where(inArray(skillsTable.id, customIds));
          for (const r of contentRows) contentMap.set(r.id, r.content);
        }
        customSkills = customRows.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category ?? "other",
          description: s.description,
          content: contentMap.get(s.id) ?? undefined,
        }));
      } catch (err) {
        console.error("[home] custom skills load failed:", err);
      }
    }
  } catch (err) {
    console.error("[home] data load failed:", err);
  }

  return (
    <Suspense>
      <HomeClient
        mulanDbId={mulanDbId}
        userName={userName}
        disabledEmployeeSlugs={disabledEmployeeSlugs}
        recentMissions={recentMissions}
        recentConversations={recentConversations}
        dispatchableEmployees={dispatchableEmployees}
        mulanSkills={mulanSkills}
        mulanKnowledgeBases={mulanKnowledgeBases}
        mulanWorkflows={mulanWorkflows}
        builtinSkills={builtinSkills}
        customSkills={customSkills}
      />
    </Suspense>
  );
}
