"use server";

import { db } from "@/db";
import { skills, knowledgeBases, workflowTemplates, articles } from "@/db/schema";
import { requireAuth } from "@/lib/demo-auth";
import { and, eq } from "drizzle-orm";
import { getCurrentUserOrg } from "@/lib/dal/auth";

type ExportableEntity = "skills" | "knowledge_bases" | "workflow_templates" | "articles";

const EXPORT_VERSION = "1.0";
const MAX_ITEMS_PER_TYPE = 500;

export type ExportPayload = {
  version: string;
  exportedAt: string;
  items: Record<ExportableEntity, unknown[]>;
};

export async function exportUserContent(): Promise<ExportPayload> {
  const user = await requireAuth();
  const userId = user.id;
  const orgId = await getCurrentUserOrg();

  const [userSkills, userKBs, userTemplates, userArticles] = await Promise.all([
    db
      .select()
      .from(skills)
      .where(and(eq(skills.createdBy, userId)))
      .limit(MAX_ITEMS_PER_TYPE),
    db
      .select()
      .from(knowledgeBases)
      .where(and(eq(knowledgeBases.createdBy, userId)))
      .limit(MAX_ITEMS_PER_TYPE),
    db
      .select()
      .from(workflowTemplates)
      .where(and(eq(workflowTemplates.createdBy, userId), eq(workflowTemplates.isBuiltin, false)))
      .limit(MAX_ITEMS_PER_TYPE),
    orgId
      ? db
          .select()
          .from(articles)
          .where(and(eq(articles.createdBy, userId)))
          .limit(MAX_ITEMS_PER_TYPE)
      : Promise.resolve([]),
  ]);

  const stripInternal = (rows: unknown[]): unknown[] =>
    rows.map((row) => {
      const r = row as Record<string, unknown>;
      const { id, organizationId, createdBy, ...rest } = r;
      return rest;
    });

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    items: {
      skills: stripInternal(userSkills),
      knowledge_bases: stripInternal(userKBs),
      workflow_templates: stripInternal(userTemplates),
      articles: stripInternal(userArticles),
    },
  };
}
