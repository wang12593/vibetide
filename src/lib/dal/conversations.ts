import { db } from "@/db";
import { savedConversations, conversationParticipants } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";

export async function getSavedConversations(
  userId: string,
  employeeSlug?: string
) {
  const conditions = [eq(savedConversations.userId, userId)];
  if (employeeSlug) {
    conditions.push(eq(savedConversations.employeeSlug, employeeSlug));
  }

  const rows = await db
    .select()
    .from(savedConversations)
    .where(and(...conditions))
    .orderBy(desc(savedConversations.updatedAt));

  const groupIds = rows
    .filter((r) => r.isGroup === 1)
    .map((r) => r.id);

  const participantMap = new Map<string, string[]>();

  if (groupIds.length > 0) {
    const participants = await db
      .select({
        conversationId: conversationParticipants.conversationId,
        participantId: conversationParticipants.participantId,
      })
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.participantType, "ai_employee"),
        )
      );

    for (const p of participants) {
      if (groupIds.includes(p.conversationId)) {
        const list = participantMap.get(p.conversationId) ?? [];
        list.push(p.participantId);
        participantMap.set(p.conversationId, list);
      }
    }
  }

  return rows.map((row) => {
    if (row.isGroup === 1) {
      const slugs = participantMap.get(row.id) ?? [];
      const existing = (row.metadata as Record<string, unknown>) ?? {};
      return {
        ...row,
        metadata: {
          ...existing,
          employeeSlugs: (existing.employeeSlugs as string[]) ?? slugs,
        },
      };
    }
    return row;
  });
}

export async function getSavedConversationById(id: string, userId: string) {
  const row = await db.query.savedConversations.findFirst({
    where: and(
      eq(savedConversations.id, id),
      eq(savedConversations.userId, userId)
    ),
  });

  if (!row) return null;

  if (row.isGroup === 1) {
    const participants = await db
      .select({
        participantId: conversationParticipants.participantId,
      })
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, id),
          eq(conversationParticipants.participantType, "ai_employee"),
        )
      );
    const slugs = participants.map((p) => p.participantId);
    const existing = (row.metadata as Record<string, unknown>) ?? {};
    return {
      ...row,
      metadata: {
        ...existing,
        employeeSlugs: (existing.employeeSlugs as string[]) ?? slugs,
      },
    };
  }

  return row;
}
