import { describe, it, expect } from "vitest";
import {
  PERMISSIONS,
  ALL_PERMISSIONS,
  ALL_MENU_PERMISSIONS,
  MENU_PERMISSION_MAP,
  TAB_PERMISSION_MAP,
  DEFAULT_ROLES,
  type Permission,
} from "@/lib/rbac-constants";

describe("PERMISSIONS — 44 permission constants", () => {
  it("has all 44 permissions defined", () => {
    expect(ALL_PERMISSIONS.length).toBe(44);
  });

  it("includes system management permissions", () => {
    expect(PERMISSIONS.SYSTEM_MANAGE_ORGS).toBe("system:manage_orgs");
    expect(PERMISSIONS.SYSTEM_MANAGE_USERS).toBe("system:manage_users");
    expect(PERMISSIONS.SYSTEM_MANAGE_ROLES).toBe("system:manage_roles");
  });

  it("includes content permissions", () => {
    expect(PERMISSIONS.CONTENT_READ).toBe("content:read");
    expect(PERMISSIONS.CONTENT_WRITE).toBe("content:write");
    expect(PERMISSIONS.CONTENT_PUBLISH).toBe("content:publish");
  });

  it("includes analytics permissions", () => {
    expect(PERMISSIONS.ANALYTICS_READ).toBe("analytics:read");
    expect(PERMISSIONS.ANALYTICS_MANAGE).toBe("analytics:manage");
  });

  it("includes AI permissions", () => {
    expect(PERMISSIONS.AI_USE).toBe("ai:use");
    expect(PERMISSIONS.AI_MANAGE).toBe("ai:manage");
  });

  it("includes all 25 menu permissions", () => {
    const menuPerms = Object.entries(PERMISSIONS)
      .filter(([k]) => k.startsWith("MENU_"))
      .map(([, v]) => v);
    expect(menuPerms).toHaveLength(25);
    expect(ALL_MENU_PERMISSIONS).toEqual(menuPerms);
  });

  it("includes news research permissions", () => {
    expect(PERMISSIONS.RESEARCH_TASK_CREATE).toBe("research:task_create");
    expect(PERMISSIONS.RESEARCH_TASK_VIEW_ORG).toBe("research:task_view_org");
  });
});

describe("MENU_PERMISSION_MAP", () => {
  it("maps /home to no permission (always visible)", () => {
    expect(MENU_PERMISSION_MAP["/home"]).toBeUndefined();
  });

  it("maps /ai-employees to menu:employees", () => {
    expect(MENU_PERMISSION_MAP["/ai-employees"]).toBe("menu:employees");
  });

  it("maps /chat to menu:chat", () => {
    expect(MENU_PERMISSION_MAP["/chat"]).toBe("menu:chat");
  });

  it("maps /missions to menu:missions", () => {
    expect(MENU_PERMISSION_MAP["/missions"]).toBe("menu:missions");
  });

  it("has at least 22 route mappings defined", () => {
    const mappedRoutes = Object.keys(MENU_PERMISSION_MAP);
    expect(mappedRoutes.length).toBeGreaterThanOrEqual(22);
  });
});

describe("TAB_PERMISSION_MAP", () => {
  it("maps /creation tabs correctly", () => {
    expect(TAB_PERMISSION_MAP["/creation"]).toBeDefined();
    expect(TAB_PERMISSION_MAP["/creation"].inspiration).toBe("menu:inspiration");
    expect(TAB_PERMISSION_MAP["/creation"].benchmarking).toBe("menu:benchmarking");
  });

  it("maps /content tabs correctly", () => {
    expect(TAB_PERMISSION_MAP["/content"]).toBeDefined();
    expect(TAB_PERMISSION_MAP["/content"].assets).toBe("menu:media_assets");
    expect(TAB_PERMISSION_MAP["/content"].articles).toBe("menu:articles");
  });

  it("maps /analytics tabs correctly", () => {
    expect(TAB_PERMISSION_MAP["/analytics"]).toBeDefined();
    expect(TAB_PERMISSION_MAP["/analytics"].publishing).toBe("menu:publishing");
  });
});

describe("DEFAULT_ROLES", () => {
  it("defines admin role with all permissions", () => {
    const admin = DEFAULT_ROLES.admin;
    expect(admin).toBeDefined();
    expect(admin.permissions).toHaveLength(44);
    expect(new Set(admin.permissions)).toEqual(new Set(ALL_PERMISSIONS));
  });

  it("defines editor role with content+analytics+AI+menu permissions", () => {
    const editor = DEFAULT_ROLES.editor;
    expect(editor).toBeDefined();
    expect(editor.permissions).toContain(PERMISSIONS.CONTENT_READ);
    expect(editor.permissions).toContain(PERMISSIONS.CONTENT_WRITE);
    expect(editor.permissions).toContain(PERMISSIONS.ANALYTICS_READ);
    expect(editor.permissions).toContain(PERMISSIONS.AI_USE);
    expect(editor.permissions).not.toContain(PERMISSIONS.SYSTEM_MANAGE_ORGS);
  });

  it("defines viewer role with limited permissions", () => {
    const viewer = DEFAULT_ROLES.viewer;
    expect(viewer).toBeDefined();
    expect(viewer.permissions).toContain(PERMISSIONS.CONTENT_READ);
    expect(viewer.permissions).toContain(PERMISSIONS.ANALYTICS_READ);
    expect(viewer.permissions).not.toContain(PERMISSIONS.CONTENT_WRITE);
    expect(viewer.permissions).not.toContain(PERMISSIONS.SYSTEM_MANAGE_ORGS);
  });

  it("has exactly 3 role templates", () => {
    expect(Object.keys(DEFAULT_ROLES)).toHaveLength(3);
  });
});