"use server";

import { db } from "@/db";
import { reviewResults, missionMessages, articles, missionTasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { requireAuth, requireCurrentOrgId } from "@/lib/demo-auth";


export async function createReviewResult(data: {
  contentId: string;
  contentType?: string;
  reviewerEmployeeId: string;
  status?: "pending" | "approved" | "rejected" | "escalated";
  issues?: {
    type: string;
    severity: "high" | "medium" | "low";
    location: string;
    description: string;
    suggestion: string;
    resolved: boolean;
  }[];
  score?: number;
}) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("No organization");

  const [row] = await db
    .insert(reviewResults)
    .values({
      organizationId: orgId,
      contentId: data.contentId,
      contentType: data.contentType || "article",
      reviewerEmployeeId: data.reviewerEmployeeId,
      status: data.status || "pending",
      issues: data.issues || [],
      score: data.score,
    })
    .returning();

  revalidatePath("/publishing");
  return row;
}

export async function updateReviewStatus(
  reviewId: string,
  status: "pending" | "approved" | "rejected" | "escalated",
  escalationReason?: string
) {
  await requireAuth();

  const updates: Record<string, unknown> = { status };

  if (status === "escalated") {
    updates.escalatedAt = new Date();
    if (escalationReason) updates.escalationReason = escalationReason;
  }

  await db
    .update(reviewResults)
    .set(updates)
    .where(eq(reviewResults.id, reviewId));

  const review = await db.query.reviewResults.findFirst({
    where: eq(reviewResults.id, reviewId),
    columns: { contentId: true, contentType: true, reviewerEmployeeId: true },
  });

  if (review) {
    let missionId: string | null = null;

    if (review.contentType === "article") {
      const article = await db.query.articles.findFirst({
        where: eq(articles.id, review.contentId),
        columns: { missionId: true },
      });
      missionId = article?.missionId ?? null;
    } else if (review.contentType === "task") {
      const task = await db.query.missionTasks.findFirst({
        where: eq(missionTasks.id, review.contentId),
        columns: { missionId: true },
      });
      missionId = task?.missionId ?? null;
    }

    if (missionId) {
      const statusLabel: Record<string, string> = {
        approved: "通过",
        rejected: "退回",
        escalated: "升级",
        pending: "待审核",
      };
      await db.insert(missionMessages).values({
        missionId,
        fromEmployeeId: review.reviewerEmployeeId,
        messageType: "status_update",
        content: `审核结果：${statusLabel[status] ?? status}`,
        channel: "system",
        structuredData: { reviewId, status, reviewType: "content_review" },
        priority: status === "rejected" || status === "escalated" ? "urgent" : "normal",
      });
    }
  }

  revalidatePath("/publishing");
}

export async function resolveReviewIssue(
  reviewId: string,
  issueIndex: number
) {
  await requireAuth();

  const review = await db.query.reviewResults.findFirst({
    where: eq(reviewResults.id, reviewId),
  });

  if (!review || !review.issues) return;

  const issues = [...(review.issues as { type: string; severity: "high" | "medium" | "low"; location: string; description: string; suggestion: string; resolved: boolean }[])];
  if (issueIndex >= 0 && issueIndex < issues.length) {
    issues[issueIndex] = { ...issues[issueIndex], resolved: true };
  }

  await db
    .update(reviewResults)
    .set({ issues })
    .where(eq(reviewResults.id, reviewId));

  revalidatePath("/publishing");
}
