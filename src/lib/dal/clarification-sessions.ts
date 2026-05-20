import { db } from "@/db";
import { clarificationSessions } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";

const SESSION_TIMEOUT_MS = 10 * 60 * 1000;

export async function upsertClarificationSession(data: {
  id?: string;
  organizationId: string;
  conversationId?: string;
  intentType: string;
  parameters: Record<string, string>;
  rounds: { role: "system" | "user"; content: string; timestamp: number }[];
  status: string;
  originalMessage?: string;
}) {
  const values = {
    organizationId: data.organizationId,
    conversationId: data.conversationId ?? null,
    intentType: data.intentType,
    parameters: data.parameters,
    rounds: data.rounds,
    status: data.status as "active" | "confirmed" | "skipped" | "expired",
    originalMessage: data.originalMessage ?? null,
    updatedAt: new Date(),
  };

  if (data.id) {
    const [updated] = await db
      .update(clarificationSessions)
      .set(values)
      .where(eq(clarificationSessions.id, data.id))
      .returning();
    return updated;
  }

  const [inserted] = await db
    .insert(clarificationSessions)
    .values(values)
    .returning();
  return inserted;
}

export async function getActiveClarificationSession(
  sessionId: string,
  orgId: string
) {
  const timeoutThreshold = new Date(Date.now() - SESSION_TIMEOUT_MS);

  const row = await db.query.clarificationSessions.findFirst({
    where: and(
      eq(clarificationSessions.id, sessionId),
      eq(clarificationSessions.organizationId, orgId),
      eq(clarificationSessions.status, "active")
    ),
  });

  if (!row) return null;

  if (row.updatedAt < timeoutThreshold) {
    await db
      .update(clarificationSessions)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(clarificationSessions.id, row.id));
    return null;
  }

  return row;
}
