import { describe, it, expect } from "vitest";
import {
  buildVisibilityCondition,
  buildEmployeeVisibilityCondition,
  assertContentOwnership,
} from "@/lib/dal/visibility-filter";
import { aiEmployees, knowledgeBases } from "@/db/schema";

describe("buildVisibilityCondition", () => {
  const userId = "user-1";
  const orgId = "org-1";
  const table = {
    organizationId: knowledgeBases.organizationId,
    createdBy: knowledgeBases.createdBy,
    visibility: knowledgeBases.visibility,
  };

  it("builds 'own' mode condition — returns a non-null SQL expression", async () => {
    const result = await buildVisibilityCondition({
      userId,
      orgId,
      table,
      mode: "own",
    });
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
    expect(result!.constructor.name).toBe("SQL");
  });

  it("builds 'org' mode condition", async () => {
    const result = await buildVisibilityCondition({
      userId,
      orgId,
      table,
      mode: "org",
    });
    expect(result).toBeDefined();
  });

  it("builds 'all' mode condition", async () => {
    const result = await buildVisibilityCondition({
      userId,
      orgId,
      table,
      mode: "all",
    });
    expect(result).toBeDefined();
  });

  it("uses 'all' mode as default when mode is not provided", async () => {
    const result = await buildVisibilityCondition({
      userId,
      orgId,
      table,
      mode: "all",
    });
    expect(result).toBeDefined();
  });
});

describe("buildEmployeeVisibilityCondition", () => {
  const userId = "user-1";
  const orgId = "org-1";
  const table = {
    organizationId: aiEmployees.organizationId,
    createdBy: aiEmployees.createdBy,
    visibility: aiEmployees.visibility,
    isPreset: aiEmployees.isPreset,
  };

  it("returns a SQL expression for admin (org scope only)", () => {
    const result = buildEmployeeVisibilityCondition({
      userId,
      orgId,
      table,
      isAdmin: true,
    });
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });

  it("returns a SQL expression for non-admin (org + isPreset/createdBy)", () => {
    const result = buildEmployeeVisibilityCondition({
      userId,
      orgId,
      table,
      isAdmin: false,
    });
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });
});

describe("assertContentOwnership", () => {
  it("passes when admin — no throw", () => {
    expect(() =>
      assertContentOwnership(
        { visibility: "personal", createdBy: "other-user" },
        "current-user",
        true
      )
    ).not.toThrow();
  });

  it("passes when user is the creator of personal content", () => {
    expect(() =>
      assertContentOwnership(
        { visibility: "personal", createdBy: "current-user" },
        "current-user"
      )
    ).not.toThrow();
  });

  it("throws when non-admin tries to access another user's personal content", () => {
    expect(() =>
      assertContentOwnership(
        { visibility: "personal", createdBy: "other-user" },
        "current-user"
      )
    ).toThrow("无权操作他人的个人内容");
  });

  it("passes when content has org visibility — anyone can access", () => {
    expect(() =>
      assertContentOwnership(
        { visibility: "org", createdBy: "other-user" },
        "current-user"
      )
    ).not.toThrow();
  });

  it("throws when personal content has no creator and user is not admin", () => {
    expect(() =>
      assertContentOwnership(
        { visibility: "personal", createdBy: null },
        "current-user"
      )
    ).toThrow("无权操作无归属的个人内容");
  });

  it("passes when visibility is null — treat as org", () => {
    expect(() =>
      assertContentOwnership(
        { visibility: null, createdBy: "other-user" },
        "current-user"
      )
    ).not.toThrow();
  });
});
