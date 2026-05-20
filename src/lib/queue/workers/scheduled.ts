import { createWorker } from "../index";
import { db } from "@/db";
import { organizations, aiEmployees, missionTasks, userProfiles, employeeMemories } from "@/db/schema";
import { eq, and, lt, isNull, inArray, notInArray, sql } from "drizzle-orm";
import { snapshotAllPerformance } from "@/lib/dal/performance";
import { getAnalyticsSummary, getAnomalyAlerts } from "@/lib/dal/analytics";
import { dispatch } from "../dispatch";
import { getDecayBatch, type DecayableMemory } from "@/lib/cognitive/memory-decay";

export function registerScheduledWorkers() {
  createWorker("scheduled", async (job) => {
    switch (job.name) {
      case "scheduled/daily-performance-snapshot":
        return dailyPerformanceSnapshotHandler();
      case "scheduled/daily-hot-briefing":
        return dailyHotBriefingHandler();
      case "scheduled/weekly-analytics-report":
        return weeklyAnalyticsReportHandler();
      case "scheduled/employee-status-guard":
        return employeeStatusGuardHandler();
      case "scheduled/learning-engine":
        return learningEngineHandler(job.data as { employeeId?: string });
      case "scheduled/skill-consistency-check":
        return skillConsistencyCheckHandler();
      case "scheduled/memory-decay":
        return memoryDecayHandler();
      default:
        console.warn(`[Scheduled Worker] Unknown job: ${job.name}`);
    }
  }, { concurrency: 3 });
}

async function dailyPerformanceSnapshotHandler() {
  const count = await snapshotAllPerformance();
  return { snapshotCount: count };
}

async function dailyHotBriefingHandler() {
  const orgs = await db.select({ id: organizations.id, settings: organizations.settings }).from(organizations).where(isNull(organizations.deletedAt));
  let successCount = 0, failureCount = 0;

  for (const org of orgs) {
    try {
      const enabled = (org.settings as any)?.dailyHotBriefing?.enabled;
      if (!enabled) continue;

      const users = await db.select({ id: userProfiles.id }).from(userProfiles)
        .where(eq(userProfiles.organizationId, org.id)).limit(1);
      if (!users[0]) continue;

      const { generateDailyHotBriefing } = await import("@/app/actions/hot-topics");
      await generateDailyHotBriefing({
        organizationId: org.id,
        trigger: "daily-cron",
        operatorId: users[0].id,
      });
      successCount++;
    } catch (err) {
      console.error(`[daily-briefing] org ${org.id}:`, err);
      failureCount++;
    }
  }

  return { total: orgs.length, successCount, failureCount };
}

async function weeklyAnalyticsReportHandler() {
  const summary = await getAnalyticsSummary();
  const alerts = await getAnomalyAlerts();

  const org = await db.query.organizations.findFirst();
  if (!org) return { reported: false };

  try {
    const { startMissionFromModule } = await import("@/app/actions/missions");
    await startMissionFromModule({
      organizationId: org.id,
      title: `周度分析报告 - ${new Date().toLocaleDateString("zh-CN")}`,
      scenario: "analytics",
      userInstruction: `基于本周数据生成分析报告。异常告警数: ${alerts.length}`,
      sourceModule: "analytics-report",
      sourceEntityType: "cron",
      sourceContext: { summary, alerts },
    });
  } catch {}

  return { reported: true, alertCount: alerts.length };
}

async function employeeStatusGuardHandler() {
  const staleThreshold = new Date(Date.now() - 30 * 60 * 1000);

  const staleEmployees = await db.select({ id: aiEmployees.id }).from(aiEmployees)
    .where(and(eq(aiEmployees.status, "working"), lt(aiEmployees.updatedAt, staleThreshold)));

  if (!staleEmployees.length) return { status: "clean", resetCount: 0, staleTaskCount: 0 };

  const staleIds = staleEmployees.map((e) => e.id);

  const staleTasks = await db.select({ id: missionTasks.id }).from(missionTasks)
    .where(and(inArray(missionTasks.assignedEmployeeId, staleIds), eq(missionTasks.status, "in_progress")));

  for (const empId of staleIds) {
    await db.update(aiEmployees).set({ status: "idle", currentTask: null, updatedAt: new Date() }).where(eq(aiEmployees.id, empId));
  }

  for (const task of staleTasks) {
    await db.update(missionTasks).set({ status: "failed", errorMessage: "超时未响应，已自动重置", updatedAt: new Date() }).where(eq(missionTasks.id, task.id));
  }

  return { status: "reset", resetCount: staleIds.length, staleTaskCount: staleTasks.length };
}

async function learningEngineHandler(data: { employeeId?: string }) {
  let employeeIds: string[] = [];

  if (data.employeeId) {
    employeeIds = [data.employeeId];
  } else {
    const all = await db.select({ id: aiEmployees.id }).from(aiEmployees);
    employeeIds = all.map((e) => e.id);
  }

  let totalPatterns = 0;

  for (const empId of employeeIds) {
    try {
      const emp = await db.query.aiEmployees.findFirst({ where: eq(aiEmployees.id, empId) });
      if (!emp) continue;

      const feedbackRows = await db.select({
        feedbackType: sql<string>`feedback_type`,
        stepKey: sql<string>`step_key`,
        count: sql<number>`COUNT(*)::int`,
      }).from(sql`user_feedback`)
        .where(and(eq(sql`employee_id`, empId), eq(sql`organization_id`, emp.organizationId)))
        .groupBy(sql`feedback_type`, sql`step_key`);

      const patterns: any[] = emp.learnedPatterns ?? [];
      for (const fb of feedbackRows) {
        if (fb.feedbackType === "reject" && fb.count >= 2) {
          patterns.push({ type: "avoid", stepKey: fb.stepKey, reason: `被拒绝 ${fb.count} 次`, learnedAt: new Date().toISOString() });
        } else if (fb.feedbackType === "edit" && fb.count >= 3) {
          patterns.push({ type: "improve", stepKey: fb.stepKey, reason: `被编辑 ${fb.count} 次`, learnedAt: new Date().toISOString() });
        } else if (fb.feedbackType === "accept" && fb.count >= 5) {
          patterns.push({ type: "maintain", stepKey: fb.stepKey, reason: `被接受 ${fb.count} 次`, learnedAt: new Date().toISOString() });
        }
      }

      if (patterns.length > (emp.learnedPatterns ?? []).length) {
        await db.update(aiEmployees).set({ learnedPatterns: patterns.slice(-20), updatedAt: new Date() }).where(eq(aiEmployees.id, empId));
        totalPatterns += patterns.length;
      }
    } catch (err) {
      console.error(`[learning-engine] employee ${empId}:`, err);
    }
  }

  return { employeesProcessed: employeeIds.length, totalPatternsAdded: totalPatterns };
}

async function skillConsistencyCheckHandler() {
  const fs = await import("fs/promises");
  const path = await import("path");

  const skillsDir = path.join(process.cwd(), "src", "data", "skills");
  const workflowsDir = path.join(process.cwd(), "src", "data", "workflows");

  let skillDrifts = 0, workflowDrifts = 0;

  try {
    const org = await db.query.organizations.findFirst();
    if (!org) return { driftCount: 0, skillDrifts: 0, workflowDrifts: 0, drifts: [] };

    const dbSkills = await db.query.skills.findMany({ where: eq(sql`organization_id`, org.id) });

    try {
      const files = await fs.readdir(skillsDir);
      for (const file of files) {
        if (!file.endsWith(".md")) continue;
        const slug = file.replace(".md", "");
        const content = await fs.readFile(path.join(skillsDir, file), "utf-8");
        const dbSkill = dbSkills.find((s) => s.slug === slug);
        if (dbSkill && dbSkill.content !== content) {
          skillDrifts++;
        }
      }
    } catch {}
  } catch (err) {
    console.error("[skill-consistency]", err);
  }

  return { driftCount: skillDrifts + workflowDrifts, skillDrifts, workflowDrifts, drifts: [] };
}

async function memoryDecayHandler() {
  const allMemories = await db.select({
    id: employeeMemories.id,
    importance: employeeMemories.importance,
    confidence: employeeMemories.confidence,
    accessCount: employeeMemories.accessCount,
    decayRate: employeeMemories.decayRate,
    createdAt: employeeMemories.createdAt,
    lastAccessedAt: employeeMemories.lastAccessedAt,
  }).from(employeeMemories) as DecayableMemory[];

  const { toUpdate, toPrune } = getDecayBatch(allMemories);

  let updated = 0, pruned = 0;

  for (const item of toUpdate) {
    await db.update(employeeMemories).set({ confidence: item.newConfidence }).where(eq(employeeMemories.id, item.id));
    updated++;
  }

  if (toPrune.length > 0) {
    await db.delete(employeeMemories).where(inArray(employeeMemories.id, toPrune));
    pruned = toPrune.length;
  }

  console.log(`[memory-decay] total: ${allMemories.length}, updated: ${updated}, pruned: ${pruned}`);
  return { total: allMemories.length, updated, pruned };
}
