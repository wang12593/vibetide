"use server";

import { db } from "@/db";
import { skills, knowledgeBases, workflowTemplates } from "@/db/schema";
import { requireAuth } from "@/lib/demo-auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import type { ExportPayload } from "./content-export";

const IMPORT_VERSION = "1.0";
const MAX_IMPORT_PER_TYPE = 200;
const MAX_JSON_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["skills", "knowledge_bases", "workflow_templates"]);

type ImportResult = {
  imported: Record<string, number>;
  skipped: Record<string, number>;
  errors: string[];
};

function validatePayload(payload: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!payload || typeof payload !== "object") {
    return { valid: false, errors: ["无效的导入数据"] };
  }

  const p = payload as Record<string, unknown>;

  if (p.version !== IMPORT_VERSION) {
    errors.push(`版本不匹配：期望 ${IMPORT_VERSION}，实际 ${String(p.version)}`);
  }

  if (!p.items || typeof p.items !== "object") {
    errors.push("缺少 items 字段");
    return { valid: false, errors };
  }

  const items = p.items as Record<string, unknown>;
  for (const key of Object.keys(items)) {
    if (!ALLOWED_TYPES.has(key)) {
      errors.push(`不允许的类型：${key}`);
    }
    if (Array.isArray(items[key]) && items[key].length > MAX_IMPORT_PER_TYPE) {
      errors.push(`${key} 超过最大导入数量限制 (${MAX_IMPORT_PER_TYPE})`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export async function importUserContent(
  raw: string
): Promise<ImportResult> {
  if (raw.length > MAX_JSON_SIZE) {
    return { imported: {}, skipped: {}, errors: [`文件大小超过限制 (${MAX_JSON_SIZE / 1024 / 1024}MB)`] };
  }

  let payload: ExportPayload;
  try {
    payload = JSON.parse(raw) as ExportPayload;
  } catch {
    return { imported: {}, skipped: {}, errors: ["JSON 解析失败"] };
  }

  const validation = validatePayload(payload);
  if (!validation.valid) {
    return { imported: {}, skipped: {}, errors: validation.errors };
  }

  const user = await requireAuth();
  const userId = user.id;
  const orgId = await getCurrentUserOrg();
  if (!orgId) {
    return { imported: {}, skipped: {}, errors: ["用户未关联组织"] };
  }

  const result: ImportResult = { imported: {}, skipped: {}, errors: [] };

  const items = payload.items as Record<string, unknown[]>;

  if (Array.isArray(items.skills)) {
    let imported = 0;
    let skipped = 0;
    for (const item of items.skills) {
      try {
        const row = item as Record<string, unknown>;
        if (!row.name || !row.category) {
          skipped++;
          continue;
        }
        await db.insert(skills).values({
          name: row.name as string,
          category: row.category as "web_search" | "data_analysis" | "content_generation" | "content_review" | "distribution" | "communication" | "learning" | "automation" | "media_production" | "planning" | "research",
          type: (row.type as "builtin" | "custom" | "plugin") ?? "custom",
          version: (row.version as string) ?? "1.0",
          description: (row.description as string) ?? "",
          content: (row.content as string) ?? "",
          slug: row.slug as string | undefined,
          createdBy: userId,
          organizationId: orgId,
          visibility: "personal",
        } as typeof skills.$inferInsert);
        imported++;
      } catch {
        skipped++;
      }
    }
    result.imported.skills = imported;
    result.skipped.skills = skipped;
  }

  if (Array.isArray(items.knowledge_bases)) {
    let imported = 0;
    let skipped = 0;
    for (const item of items.knowledge_bases) {
      try {
        const row = item as Record<string, unknown>;
        if (!row.name) {
          skipped++;
          continue;
        }
        await db.insert(knowledgeBases).values({
          name: row.name as string,
          description: (row.description as string) ?? "",
          organizationId: orgId,
          createdBy: userId,
          visibility: "personal",
        });
        imported++;
      } catch {
        skipped++;
      }
    }
    result.imported.knowledge_bases = imported;
    result.skipped.knowledge_bases = skipped;
  }

  if (Array.isArray(items.workflow_templates)) {
    let imported = 0;
    let skipped = 0;
    for (const item of items.workflow_templates) {
      try {
        const row = item as Record<string, unknown>;
        if (!row.name) {
          skipped++;
          continue;
        }
        await db.insert(workflowTemplates).values({
          name: row.name as string,
          description: (row.description as string) ?? "",
          steps: (row.steps as unknown[]) ?? [],
          organizationId: orgId,
          createdBy: userId,
          isBuiltin: false,
          defaultTeam: (row.defaultTeam as string[]) ?? [],
        } as typeof workflowTemplates.$inferInsert);
        imported++;
      } catch {
        skipped++;
      }
    }
    result.imported.workflow_templates = imported;
    result.skipped.workflow_templates = skipped;
  }

  return result;
}
