"use server";

import { db } from "@/db";
import { userAiPreferences } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireCurrentOrgId } from "@/lib/demo-auth";
import type { FrequentIntent, PreferredAssignment } from "@/db/schema/user-ai-preferences";

export async function getUserAiPreferences() {
  const user = await requireAuth();
  const orgId = await requireCurrentOrgId();

  const row = await db.query.userAiPreferences.findFirst({
    where: and(
      eq(userAiPreferences.userId, user.id),
      eq(userAiPreferences.organizationId, orgId),
    ),
  });

  return row ?? null;
}

const INTENT_SUGGESTIONS: Record<string, string[]> = {
  information_retrieval: ["帮我搜索今日热点新闻", "查一下最近的行业动态"],
  content_creation: ["帮我写一篇关于AI的深度报道", "生成一篇科技评论文章"],
  deep_analysis: ["分析一下当前的舆论趋势", "对比分析两篇热门文章"],
  data_analysis: ["整理本周的内容数据表现", "分析用户互动数据趋势"],
  content_review: ["帮我审核一篇稿件", "检查文章的敏感词和规范性"],
  media_production: ["制作一个短视频脚本", "帮我生成图文搭配方案"],
  publishing: ["制定今日发布计划", "优化各渠道的发布策略"],
};

export async function getUserSuggestions(): Promise<string[]> {
  const user = await requireAuth();
  const orgId = await requireCurrentOrgId();

  const row = await db.query.userAiPreferences.findFirst({
    where: and(
      eq(userAiPreferences.userId, user.id),
      eq(userAiPreferences.organizationId, orgId),
    ),
  });

  if (!row || !row.frequentIntents || row.frequentIntents.length === 0) {
    return ["帮我追踪今日热点", "写一篇科技评论", "分析最近的舆论趋势"];
  }

  const sorted = [...(row.frequentIntents as FrequentIntent[])]
    .sort((a, b) => b.count - a.count);

  const suggestions: string[] = [];
  for (const intent of sorted.slice(0, 3)) {
    const pool = INTENT_SUGGESTIONS[intent.intentType];
    if (pool && pool.length > 0) {
      suggestions.push(pool[Math.floor(Math.random() * pool.length)]);
    }
  }

  if (suggestions.length < 3) {
    const defaults = ["帮我追踪今日热点", "写一篇科技评论", "分析最近的舆论趋势"];
    for (const d of defaults) {
      if (suggestions.length >= 3) break;
      if (!suggestions.includes(d)) suggestions.push(d);
    }
  }

  return suggestions.slice(0, 3);
}

export async function upsertFrequentIntent(intentType: string) {
  const user = await requireAuth();
  const orgId = await requireCurrentOrgId();

  const existing = await db.query.userAiPreferences.findFirst({
    where: and(
      eq(userAiPreferences.userId, user.id),
      eq(userAiPreferences.organizationId, orgId),
    ),
  });

  if (!existing) {
    const intents: FrequentIntent[] = [
      { intentType, count: 1, lastTriggered: new Date().toISOString() },
    ];
    await db.insert(userAiPreferences).values({
      userId: user.id,
      organizationId: orgId,
      frequentIntents: intents,
      preferredAssignments: [],
    });
    return;
  }

  const intents: FrequentIntent[] = [...(existing.frequentIntents ?? [])];
  const idx = intents.findIndex((i) => i.intentType === intentType);
  if (idx >= 0) {
    intents[idx] = {
      ...intents[idx],
      count: intents[idx].count + 1,
      lastTriggered: new Date().toISOString(),
    };
  } else {
    intents.push({
      intentType,
      count: 1,
      lastTriggered: new Date().toISOString(),
    });
  }

  await db
    .update(userAiPreferences)
    .set({ frequentIntents: intents, updatedAt: new Date() })
    .where(eq(userAiPreferences.id, existing.id));
}

export async function upsertPreferredAssignment(
  intentType: string,
  steps: { employeeSlug: string; skills: string[] }[],
  userEdited: boolean,
) {
  const user = await requireAuth();
  const orgId = await requireCurrentOrgId();

  const existing = await db.query.userAiPreferences.findFirst({
    where: and(
      eq(userAiPreferences.userId, user.id),
      eq(userAiPreferences.organizationId, orgId),
    ),
  });

  if (!existing) {
    const assignments: PreferredAssignment[] = [
      {
        intentType,
        steps,
        userConfirmed: 1,
        userEdited: userEdited ? 1 : 0,
      },
    ];
    await db.insert(userAiPreferences).values({
      userId: user.id,
      organizationId: orgId,
      frequentIntents: [],
      preferredAssignments: assignments,
    });
    return;
  }

  const assignments: PreferredAssignment[] = [
    ...(existing.preferredAssignments ?? []),
  ];
  const idx = assignments.findIndex((a) => a.intentType === intentType);
  if (idx >= 0) {
    assignments[idx] = {
      ...assignments[idx],
      userConfirmed: assignments[idx].userConfirmed + 1,
      userEdited: assignments[idx].userEdited + (userEdited ? 1 : 0),
      steps: userEdited ? steps : assignments[idx].steps,
    };
  } else {
    assignments.push({
      intentType,
      steps,
      userConfirmed: 1,
      userEdited: userEdited ? 1 : 0,
    });
  }

  await db
    .update(userAiPreferences)
    .set({ preferredAssignments: assignments, updatedAt: new Date() })
    .where(eq(userAiPreferences.id, existing.id));
}
