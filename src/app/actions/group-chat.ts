"use server";

import { db } from "@/db";
import { savedConversations, conversationParticipants } from "@/db/schema";
import { requireAuth, requireCurrentOrgId } from "@/lib/demo-auth";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";

export async function createGroupChat(params: {
  title: string;
  employeeSlugs: string[];
  mode?: "serial" | "parallel";
  leaderEmployeeSlug?: string;
  intentSteps?: Array<{
    employeeSlug: string;
    employeeName: string;
    taskDescription: string;
    skills: string[];
  }>;
}): Promise<{ id: string; title: string }> {
  const user = await requireAuth();
  const userId = user.id;
  const orgId = await requireCurrentOrgId();

  if (params.employeeSlugs.length < 2) {
    throw new Error("群聊至少需要 2 个员工");
  }
  if (params.employeeSlugs.length > 6) {
    throw new Error("群聊最多 6 个员工");
  }

  const title = params.title || `群聊（${params.employeeSlugs.length}人）`;

  try {
    const result = await db.transaction(async (tx) => {
      const [conv] = await tx
        .insert(savedConversations)
        .values({
          userId,
          employeeSlug: null,
          title,
          messages: [],
          organizationId: orgId,
          isGroup: 1,
          groupMode: params.mode ?? "serial",
          leaderEmployeeSlug: params.leaderEmployeeSlug ?? null,
          metadata: { employeeSlugs: params.employeeSlugs, intentSteps: params.intentSteps ?? null },
        })
        .returning({ id: savedConversations.id, title: savedConversations.title });

      if (!conv) throw new Error("创建群聊失败");

      await tx.insert(conversationParticipants).values(
        params.employeeSlugs.map((slug) => ({
          conversationId: conv.id,
          participantType: "ai_employee" as const,
          participantId: slug,
          role: (slug === params.leaderEmployeeSlug ? "leader" : "member") as "leader" | "member",
          organizationId: orgId,
        }))
      );

      await tx.insert(conversationParticipants).values({
        conversationId: conv.id,
        participantType: "human",
        participantId: userId,
        role: "leader",
        organizationId: orgId,
      });

      return conv;
    });

    revalidatePath("/chat");
    return { id: result.id, title: result.title };
  } catch (err) {
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : "";
    const msg = cause || (err instanceof Error ? err.message : String(err));
    console.error("[group-chat] create failed:", err);
    throw new Error("群聊创建失败: " + msg);
  }
}

export async function addGroupParticipant(params: {
  conversationId: string;
  employeeSlug: string;
}): Promise<void> {
  const user = await requireAuth();
  const orgId = await requireCurrentOrgId();

  const conv = await db.query.savedConversations.findFirst({
    where: and(
      eq(savedConversations.id, params.conversationId),
      eq(savedConversations.userId, user.id),
      eq(savedConversations.organizationId, orgId)
    ),
  });
  if (!conv) throw new Error("无权操作此群聊");

  const existing = await db
    .select()
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, params.conversationId),
        eq(conversationParticipants.participantId, params.employeeSlug)
      )
    )
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(conversationParticipants).values({
    conversationId: params.conversationId,
    participantType: "ai_employee",
    participantId: params.employeeSlug,
    role: "member",
    organizationId: orgId,
  });

  const meta = (conv.metadata as Record<string, unknown>) ?? {};
  const slugs = ((meta.employeeSlugs as string[]) ?? []);
  if (!slugs.includes(params.employeeSlug)) {
    slugs.push(params.employeeSlug);
    await db
      .update(savedConversations)
      .set({ metadata: { ...meta, employeeSlugs: slugs }, title: `群聊（${slugs.length}人）` })
      .where(eq(savedConversations.id, params.conversationId));
  }

  revalidatePath("/chat");
}

export async function removeGroupParticipant(params: {
  conversationId: string;
  employeeSlug: string;
}): Promise<void> {
  const user = await requireAuth();
  const orgId = await requireCurrentOrgId();

  const conv = await db.query.savedConversations.findFirst({
    where: and(
      eq(savedConversations.id, params.conversationId),
      eq(savedConversations.userId, user.id),
      eq(savedConversations.organizationId, orgId)
    ),
  });
  if (!conv) throw new Error("无权操作此群聊");

  await db
    .delete(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, params.conversationId),
        eq(conversationParticipants.participantId, params.employeeSlug),
        eq(conversationParticipants.participantType, "ai_employee")
      )
    );

  const meta = (conv.metadata as Record<string, unknown>) ?? {};
  const slugs = ((meta.employeeSlugs as string[]) ?? []).filter(
    (s) => s !== params.employeeSlug
  );
  await db
    .update(savedConversations)
    .set({ metadata: { ...meta, employeeSlugs: slugs }, title: `群聊（${slugs.length}人）` })
    .where(eq(savedConversations.id, params.conversationId));

  revalidatePath("/chat");
}

export async function archiveGroupChat(conversationId: string): Promise<void> {
  const user = await requireAuth();
  const orgId = await requireCurrentOrgId();

  await db
    .delete(savedConversations)
    .where(
      and(
        eq(savedConversations.id, conversationId),
        eq(savedConversations.userId, user.id),
        eq(savedConversations.organizationId, orgId)
      )
    );

  revalidatePath("/chat");
}

export async function createMissionGroupChat(params: {
  missionId: string;
  missionTitle: string;
  employeeSlugs: string[];
  mode?: "serial" | "parallel";
  leaderEmployeeSlug?: string;
  userId: string;
  orgId: string;
}): Promise<string | null> {
  if (params.employeeSlugs.length < 2) return null;

  const title = `${params.missionTitle}（${params.employeeSlugs.length}人）`;

  const result = await db.transaction(async (tx) => {
    const [conv] = await tx
      .insert(savedConversations)
      .values({
        userId: params.userId,
        employeeSlug: null,
        title,
        messages: [],
        organizationId: params.orgId,
        isGroup: 1,
        groupMode: params.mode ?? "serial",
        leaderEmployeeSlug: params.leaderEmployeeSlug ?? null,
        metadata: { missionId: params.missionId, source: "mission_auto" },
      })
      .returning({ id: savedConversations.id });

    if (!conv) return null;

    await tx.insert(conversationParticipants).values(
      params.employeeSlugs.map((slug) => ({
        conversationId: conv.id,
        participantType: "ai_employee" as const,
        participantId: slug,
        role: (slug === params.leaderEmployeeSlug ? "leader" : "member") as "leader" | "member",
        organizationId: params.orgId,
      }))
    );

    await tx.insert(conversationParticipants).values({
      conversationId: conv.id,
      participantType: "human",
      participantId: params.userId,
      role: "leader",
      organizationId: params.orgId,
    });

    return conv;
  });

  revalidatePath("/chat");
  return result?.id ?? null;
}
