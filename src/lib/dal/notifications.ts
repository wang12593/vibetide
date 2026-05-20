import { db } from "@/db";
import { messageReads, missionMessages, missions } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function markAsRead(userId: string, messageId: string) {
  await db
    .insert(messageReads)
    .values({ userId, messageId })
    .onConflictDoNothing();
}

export async function markAllAsRead(userId: string, scopeId: string) {
  const rows = await db
    .select({ id: missionMessages.id })
    .from(missionMessages)
    .where(eq(missionMessages.missionId, scopeId));

  if (rows.length === 0) return;

  await db
    .insert(messageReads)
    .values(rows.map((r) => ({ userId, messageId: r.id })))
    .onConflictDoNothing();
}

export async function getUnreadCount(
  organizationId: string,
  userId: string
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(missionMessages)
    .innerJoin(missions, eq(missionMessages.missionId, missions.id))
    .leftJoin(
      messageReads,
      and(
        eq(messageReads.messageId, missionMessages.id),
        eq(messageReads.userId, userId)
      )
    )
    .where(
      and(
        eq(missions.organizationId, organizationId),
        sql`${messageReads.id} IS NULL`
      )
    );

  return result[0]?.count ?? 0;
}
