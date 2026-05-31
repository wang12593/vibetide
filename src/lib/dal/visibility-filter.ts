import { and, or, eq, type SQL } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm/column";

export type VisibilityTable = {
  organizationId: AnyColumn;
  createdBy: AnyColumn;
  visibility: AnyColumn;
};

export type EmployeeVisibilityTable = VisibilityTable & {
  isPreset: AnyColumn;
};

export async function buildVisibilityCondition(opts: {
  userId: string;
  orgId: string;
  table: VisibilityTable;
  mode: "all" | "own" | "org";
}): Promise<SQL | undefined> {
  const { userId, orgId, table, mode } = opts;

  const orgScope = eq(table.organizationId, orgId);

  switch (mode) {
    case "own":
      return and(orgScope, eq(table.createdBy, userId));
    case "org":
      return and(orgScope, eq(table.visibility, "org"));
    case "all":
    default:
      return and(orgScope, or(eq(table.visibility, "org"), eq(table.createdBy, userId)));
  }
}

export function buildEmployeeVisibilityCondition(opts: {
  userId: string;
  orgId: string;
  table: EmployeeVisibilityTable;
  isAdmin: boolean;
}): SQL {
  const { userId, orgId, table, isAdmin } = opts;
  const orgScope = eq(table.organizationId, orgId);

  if (isAdmin) return orgScope;

  return and(orgScope, or(eq(table.isPreset, 1), eq(table.createdBy, userId)))!;
}

export function assertContentOwnership(
  item: { visibility: string | null; createdBy: string | null },
  userId: string,
  isAdmin?: boolean
): void {
  if (isAdmin) return;
  if (item.visibility === "personal" && !item.createdBy) {
    throw new Error("无权操作无归属的个人内容");
  }
  if (item.visibility === "personal" && item.createdBy !== userId) {
    throw new Error("无权操作他人的个人内容");
  }
}
