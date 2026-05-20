"use server";

import { db } from "@/db";
import { savedConversations } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { revalidatePath } from "next/cache";
import { requireAuth, requireCurrentOrgId } from "@/lib/demo-auth";

type ConversationMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  durationMs?: number;
  thinkingSteps?: { tool: string; label: string; skillName?: string }[];
  skillsUsed?: { tool: string; skillName: string }[];
  sources?: string[];
  referenceCount?: number;
  kind?: "text" | "mission_card" | "clarification" | "parameter_confirmation";
  missionId?: string;
  templateId?: string;
  templateName?: string;
};

export async function saveConversation(data: {
  employeeSlug: string;
  title: string;
  summary?: string;
  messages: ConversationMessage[];
  scenarioId?: string;
  metadata?: Record<string, unknown>;
}) {
  const user = await requireAuth();
  const orgId = await requireCurrentOrgId();

  const [row] = await db
    .insert(savedConversations)
    .values({
      organizationId: orgId,
      userId: user.id,
      employeeSlug: data.employeeSlug,
      title: data.title,
      summary: data.summary ?? null,
      messages: data.messages,
      scenarioId: data.scenarioId ?? null,
      metadata: data.metadata ?? null,
    })
    .returning();

  revalidatePath("/chat");
  return row;
}

export async function getLatestConversation(employeeSlug: string) {
  const user = await requireAuth();

  const row = await db.query.savedConversations.findFirst({
    where: and(
      eq(savedConversations.userId, user.id),
      eq(savedConversations.employeeSlug, employeeSlug),
    ),
    orderBy: desc(savedConversations.updatedAt),
  });

  return row ?? null;
}

export async function getConversationById(id: string) {
  const user = await requireAuth();
  const row = await db.query.savedConversations.findFirst({
    where: and(
      eq(savedConversations.id, id),
      eq(savedConversations.userId, user.id),
    ),
  });
  return row ?? null;
}

export async function upsertConversationMessages(
  conversationId: string | null,
  employeeSlug: string,
  messages: ConversationMessage[],
) {
  const user = await requireAuth();
  const orgId = await requireCurrentOrgId();

  if (messages.length === 0) return null;

  const userMsgs = messages.filter((m) => m.role === "user");
  const summary = userMsgs.length > 0
    ? userMsgs.map((m) => m.content.slice(0, 60)).join("；").slice(0, 200)
    : null;

  if (conversationId) {
    await db
      .update(savedConversations)
      .set({ messages, updatedAt: new Date(), summary })
      .where(
        and(
          eq(savedConversations.id, conversationId),
          eq(savedConversations.userId, user.id),
        ),
      );
    return conversationId;
  }

  const firstUserMsg = messages.find((m) => m.role === "user");
  const title = firstUserMsg
    ? firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? "..." : "")
    : "新对话";

  const [row] = await db
    .insert(savedConversations)
    .values({
      organizationId: orgId,
      userId: user.id,
      employeeSlug,
      title,
      messages,
      summary,
    })
    .returning();

  revalidatePath("/chat");
  return row?.id ?? null;
}

export async function deleteSavedConversation(id: string) {
  const user = await requireAuth();

  await db
    .delete(savedConversations)
    .where(
      and(
        eq(savedConversations.id, id),
        eq(savedConversations.userId, user.id),
      ),
    );

  revalidatePath("/chat");
}

export async function updateConversationTitle(id: string, title: string) {
  const user = await requireAuth();

  const [updated] = await db
    .update(savedConversations)
    .set({ title, updatedAt: new Date() })
    .where(
      and(
        eq(savedConversations.id, id),
        eq(savedConversations.userId, user.id),
      ),
    )
    .returning();

  revalidatePath("/chat");
  return updated ?? null;
}
