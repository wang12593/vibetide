"use server";

import { db } from "@/db";
import {
  aiEmployees,
  missions,
  knowledgeBases,
  skills,
  contentTrailLogs,
} from "@/db/schema";
import { requireAuth } from "@/lib/demo-auth";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

type ContentType = "employee" | "mission" | "knowledge_base" | "skill";

const TABLE_MAP: Record<ContentType, { table: any; nameField: string }> = {
  employee: { table: aiEmployees, nameField: "name" },
  mission: { table: missions, nameField: "title" },
  knowledge_base: { table: knowledgeBases, nameField: "name" },
  skill: { table: skills, nameField: "name" },
};

export async function upgradeContentVisibility(
  contentType: ContentType,
  id: string
): Promise<{ success: boolean }> {
  const user = await requireAuth();
  const userId = user.id;
  const entry = TABLE_MAP[contentType];
  if (!entry) throw new Error(`Unknown content type: ${contentType}`);

  const [row] = await db
    .select()
    .from(entry.table)
    .where(eq(entry.table.id, id))
    .limit(1);

  if (!row) throw new Error("内容不存在");
  if (row.visibility === "org") throw new Error("已经是组织级，无需升级");
  if (row.createdBy !== userId) {
    throw new Error("只有创建者可以升级可见性");
  }

  await db
    .update(entry.table)
    .set({ visibility: "org" })
    .where(eq(entry.table.id, id));

  try {
    await db.insert(contentTrailLogs).values({
      organizationId: row.organizationId,
      contentId: id,
      contentType: contentType,
      operator: userId,
      operatorType: "human",
      action: "edit",
      stage: "review_1",
      metadata: { visibilityChange: "personal→org" },
    });
  } catch {}

  revalidatePath("/");
  return { success: true };
}
