import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindFirst = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockInnerJoin = vi.fn();
const mockWhere = vi.fn();

vi.mock("react", () => ({
  cache: (fn: any) => fn,
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      userProfiles: {
        findFirst: (...args: any[]) => mockFindFirst(...args),
      },
    },
    select: (cols: any) => ({
      from: (t: any) => ({
        innerJoin: (t2: any, on: any) => ({
          where: (cond: any) => mockWhere(cond),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/dal/auth", () => ({
  getCurrentUserAndOrg: vi.fn(),
}));

import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { isSuperAdmin, getUserPermissions, hasPermission, hasAnyPermission, requirePermission } from "@/lib/rbac";
import { ALL_PERMISSIONS } from "@/lib/rbac-constants";

describe("isSuperAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when user has isSuperAdmin=true", async () => {
    mockFindFirst.mockResolvedValue({ isSuperAdmin: true });
    expect(await isSuperAdmin("user-1")).toBe(true);
    expect(mockFindFirst).toHaveBeenCalled();
  });

  it("returns false when user has isSuperAdmin=false", async () => {
    mockFindFirst.mockResolvedValue({ isSuperAdmin: false });
    expect(await isSuperAdmin("user-1")).toBe(false);
  });

  it("returns false when profile not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    expect(await isSuperAdmin("user-1")).toBe(false);
  });
});

describe("getUserPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all permissions for super admin", async () => {
    mockFindFirst.mockResolvedValue({ isSuperAdmin: true });
    const perms = await getUserPermissions("user-1", "org-1");
    expect(perms).toEqual([...ALL_PERMISSIONS]);
    expect(perms).toHaveLength(44);
  });

  it("returns merged permissions from multiple roles for non-admin", async () => {
    mockFindFirst.mockResolvedValue({ isSuperAdmin: false });
    mockWhere.mockResolvedValue([
      { permissions: ["content:read", "content:write", "menu:missions"] },
      { permissions: ["analytics:read", "menu:missions"] },
    ]);
    const perms = await getUserPermissions("user-1", "org-1");
    expect(perms).toContain("content:read");
    expect(perms).toContain("content:write");
    expect(perms).toContain("analytics:read");
    expect(perms).toContain("menu:missions");
    expect(perms).toHaveLength(4);
  });

  it("returns empty permissions when user has no roles", async () => {
    mockFindFirst.mockResolvedValue({ isSuperAdmin: false });
    mockWhere.mockResolvedValue([]);
    const perms = await getUserPermissions("user-1", "org-1");
    expect(perms).toEqual([]);
  });
});

describe("hasPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when permission exists", async () => {
    mockFindFirst.mockResolvedValue({ isSuperAdmin: false });
    mockWhere.mockResolvedValue([
      { permissions: ["content:read", "menu:missions"] },
    ]);
    expect(await hasPermission("user-1", "org-1", "menu:missions")).toBe(true);
  });

  it("returns false when permission does not exist", async () => {
    mockFindFirst.mockResolvedValue({ isSuperAdmin: false });
    mockWhere.mockResolvedValue([
      { permissions: ["content:read"] },
    ]);
    expect(await hasPermission("user-1", "org-1", "system:manage_orgs")).toBe(false);
  });
});

describe("hasAnyPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when any permission matches", async () => {
    mockFindFirst.mockResolvedValue({ isSuperAdmin: false });
    mockWhere.mockResolvedValue([
      { permissions: ["content:read"] },
    ]);
    expect(
      await hasAnyPermission("user-1", "org-1", ["system:manage_orgs", "content:read"])
    ).toBe(true);
  });

  it("returns false when no permission matches", async () => {
    mockFindFirst.mockResolvedValue({ isSuperAdmin: false });
    mockWhere.mockResolvedValue([
      { permissions: ["content:read"] },
    ]);
    expect(
      await hasAnyPermission("user-1", "org-1", ["system:manage_orgs", "system:manage_users"])
    ).toBe(false);
  });
});

describe("requirePermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns context when user has permission", async () => {
    mockFindFirst.mockResolvedValue({ isSuperAdmin: false });
    mockWhere.mockResolvedValue([
      { permissions: ["menu:missions"] },
    ]);
    vi.mocked(getCurrentUserAndOrg).mockResolvedValue({
      userId: "user-1",
      organizationId: "org-1",
    });

    const ctx = await requirePermission("menu:missions");
    expect(ctx).toEqual({ userId: "user-1", organizationId: "org-1" });
  });

  it("throws '未登录' when not authenticated", async () => {
    vi.mocked(getCurrentUserAndOrg).mockResolvedValue(null);
    await expect(requirePermission("menu:missions")).rejects.toThrow("未登录");
  });

  it("throws '无权限执行此操作' when permission missing", async () => {
    mockFindFirst.mockResolvedValue({ isSuperAdmin: false });
    mockWhere.mockResolvedValue([
      { permissions: ["content:read"] },
    ]);
    vi.mocked(getCurrentUserAndOrg).mockResolvedValue({
      userId: "user-1",
      organizationId: "org-1",
    });

    await expect(requirePermission("system:manage_orgs")).rejects.toThrow("无权限执行此操作");
  });
});