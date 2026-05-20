"use server";

import { db } from "@/db";
import { channels, publishPlans, missionMessages, articles, missions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { requireAuth, requireCurrentOrgId } from "@/lib/demo-auth";


// --- Channel Management (F3.1.07) ---

export async function createChannel(data: {
  name: string;
  platform: string;
  icon?: string;
  followers?: number;
}) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("No organization");

  const [row] = await db
    .insert(channels)
    .values({
      organizationId: orgId,
      name: data.name,
      platform: data.platform,
      icon: data.icon || "",
      followers: data.followers || 0,
      status: "setup",
    })
    .returning();

  revalidatePath("/publishing");
  return row;
}

export async function updateChannelStatus(
  channelId: string,
  status: "active" | "paused" | "setup"
) {
  await requireAuth();

  await db
    .update(channels)
    .set({ status, updatedAt: new Date() })
    .where(eq(channels.id, channelId));

  revalidatePath("/publishing");
}

export async function deleteChannel(channelId: string) {
  await requireAuth();

  await db.delete(channels).where(eq(channels.id, channelId));

  revalidatePath("/publishing");
}

// --- Publish Plans (F3.1.01-06) ---

export async function createPublishPlan(data: {
  channelId: string;
  taskId?: string;
  title: string;
  scheduledAt: string;
  adaptedContent?: {
    headline?: string;
    body?: string;
    coverImage?: string;
    tags?: string[];
    format?: string;
  };
}) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("No organization");

  const [row] = await db
    .insert(publishPlans)
    .values({
      organizationId: orgId,
      channelId: data.channelId,
      taskId: data.taskId || null,
      title: data.title,
      scheduledAt: new Date(data.scheduledAt),
      adaptedContent: data.adaptedContent,
      status: "scheduled",
    })
    .returning();

  revalidatePath("/publishing");
  return row;
}

export async function updatePublishPlanStatus(
  planId: string,
  status: "scheduled" | "publishing" | "published" | "failed"
) {
  await requireAuth();

  const updates: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };

  if (status === "published") {
    updates.publishedAt = new Date();
  }

  await db
    .update(publishPlans)
    .set(updates)
    .where(eq(publishPlans.id, planId));

  const plan = await db.query.publishPlans.findFirst({
    where: eq(publishPlans.id, planId),
    columns: { taskId: true },
  });

  if (plan?.taskId) {
    const article = await db.query.articles.findFirst({
      where: eq(articles.taskId, plan.taskId),
      columns: { missionId: true, assigneeId: true },
    });

    if (article?.missionId) {
      const mission = await db.query.missions.findFirst({
        where: eq(missions.id, article.missionId),
        columns: { leaderEmployeeId: true },
      });

      const fromEmployeeId = article.assigneeId ?? mission?.leaderEmployeeId;

      if (fromEmployeeId) {
        const statusLabel: Record<string, string> = {
          scheduled: "已排期",
          publishing: "发布中",
          published: "已发布",
          failed: "发布失败",
        };
        await db.insert(missionMessages).values({
          missionId: article.missionId,
          fromEmployeeId,
          messageType: "status_update",
          content: `发布计划状态更新：${statusLabel[status] ?? status}`,
          channel: "system",
          structuredData: { publishPlanId: planId, status, taskId: plan.taskId },
          priority: status === "failed" ? "urgent" : "normal",
        });
      }
    }
  }

  revalidatePath("/publishing");
  revalidatePath("/analytics");
}

export async function deletePublishPlan(planId: string) {
  await requireAuth();

  await db.delete(publishPlans).where(eq(publishPlans.id, planId));

  revalidatePath("/publishing");
}

export async function reschedulePublishPlan(
  planId: string,
  newScheduledAt: string
) {
  await requireAuth();

  await db
    .update(publishPlans)
    .set({
      scheduledAt: new Date(newScheduledAt),
      updatedAt: new Date(),
    })
    .where(eq(publishPlans.id, planId));

  revalidatePath("/publishing");
}
