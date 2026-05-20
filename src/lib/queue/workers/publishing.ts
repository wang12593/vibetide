import { createWorker } from "../index";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { isNull } from "drizzle-orm";

async function getDefaultOrgId() {
  const org = await db.query.organizations.findFirst({ where: isNull(organizations.deletedAt) });
  return org?.id;
}

export function registerPublishingWorkers() {
  createWorker("publishing", async (job) => {
    const { startMissionFromModule } = await import("@/app/actions/missions");
    const orgId = await getDefaultOrgId();
    if (!orgId) return { status: "skipped", reason: "no org" };

    switch (job.name) {
      case "publishing/review.completed": {
        const data = job.data as { status: string; articleTitle: string; articleId: string; reason?: string };
        if (data.status !== "approved" && data.status !== "rejected") return { status: "skipped" };
        await startMissionFromModule({
          organizationId: orgId,
          title: `审核${data.status === "approved" ? "通过" : "驳回"}: ${data.articleTitle}`,
          scenario: "publishing",
          userInstruction: `文章"${data.articleTitle}"审核${data.status}。${data.reason ?? ""}`,
          sourceModule: "publishing-events",
          sourceEntityType: "review",
          sourceContext: data,
        });
        return { status: "notified" };
      }
      case "publishing/plan.status-changed": {
        const data = job.data as { status: string; planTitle: string; planId: string; error?: string };
        if (!["published", "failed"].includes(data.status)) return { status: "skipped" };
        await startMissionFromModule({
          organizationId: orgId,
          title: `发布计划${data.status === "published" ? "完成" : "失败"}: ${data.planTitle}`,
          scenario: "publishing",
          userInstruction: `发布计划"${data.planTitle}"状态变更为${data.status}。${data.error ?? ""}`,
          sourceModule: "publishing-events",
          sourceEntityType: "plan",
          sourceContext: data,
        });
        return { status: "notified" };
      }
      case "publishing/anomaly.detected": {
        const data = job.data as { severity: string; metric: string; channel: string; description: string };
        await startMissionFromModule({
          organizationId: orgId,
          title: `异常告警: ${data.metric} - ${data.severity}`,
          scenario: "analytics",
          userInstruction: `检测到异常: ${data.description}`,
          sourceModule: "publishing-events",
          sourceEntityType: "anomaly",
          sourceContext: data,
        });
        return { status: "alerted", severity: data.severity };
      }
      default:
        console.warn(`[Publishing Worker] Unknown job: ${job.name}`);
    }
  }, { concurrency: 3 });
}
