/**
 * TC-M8-HT-001 / TC-M9-CHN-001 / TC-M10-ADM-001 / TC-M10-RTE-001
 *
 * 流程6: 热点话题 → 渠道管理 → 管理后台 → 更多路由
 *
 * 覆盖用例:
 *   M8-HT-001   热点话题页面可访问
 *   M9-CHN-001  渠道设置页面可访问
 *   M10-ADM-001 管理后台用户管理可访问（admin）
 *   M10-ADM-003 管理后台角色权限可访问（admin）
 *   M10-ADM-005 管理后台组织管理可访问（admin）
 *   M10-MLN-001 穆兰配置页面可访问
 *   M10-RTE-001 更多受保护路由可访问
 *   M3-SKL-001  技能详情页面可访问
 *   M10-ADM-002 viewer 无权访问管理后台
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("流程6: 热点话题 → 渠道 → 管理后台", () => {
  test("TC-M8-HT-001: /hot-topics 热点话题页面可访问", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/hot-topics");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: 10_000 });
    expect(page.url()).not.toContain("/login");
  });

  test("TC-M9-CHN-001: /settings/channels 渠道设置页面可访问", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/settings/channels");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: 10_000 });
    expect(page.url()).not.toContain("/login");
  });

  test("TC-M10-ADM-001: /admin/users 用户管理页面可访问", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/users");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: 10_000 });
    expect(page.url()).not.toContain("/login");
  });

  test("TC-M10-ADM-003: /admin/roles 角色权限页面可访问", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/roles");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: 10_000 });
    expect(page.url()).not.toContain("/login");
  });

  test("TC-M10-ADM-005: /admin/organizations 组织管理页面可访问", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/organizations");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: 10_000 });
    expect(page.url()).not.toContain("/login");
  });

  test("TC-M10-MLN-001: /settings/mulan-config 穆兰配置页面可访问", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/settings/mulan-config");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: 10_000 });
    expect(page.url()).not.toContain("/login");
  });

  test("TC-M10-RTE-001a: /analytics 数据分析页面可访问", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/analytics");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: 10_000 });
    expect(page.url()).not.toContain("/login");
  });

  test("TC-M10-RTE-001b: /approvals 审批中心页面可访问", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/approvals");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: 10_000 });
    expect(page.url()).not.toContain("/login");
  });

  test("TC-M10-RTE-001c: /media-assets 媒体素材页面可访问", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/media-assets");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: 10_000 });
    expect(page.url()).not.toContain("/login");
  });

  test("TC-M10-ADM-002: viewer 访问 /admin/users 应被权限系统拒绝", async ({ page }) => {
    await loginAs(page, "viewer");

    // 权限系统在 SSR 层抛错，监听服务端返回状态
    let responseStatus = 200;
    page.on("response", (res) => {
      if (res.url().includes("/admin/users")) {
        responseStatus = res.status();
      }
    });

    await page.goto("/admin/users");
    await page.waitForLoadState("domcontentloaded");

    // SSR 层 throw 导致 Next.js 返回 500 或在 dev 模式下显示错误覆盖层
    // 也可能返回 200 但内容为首页（因为 dev error overlay 覆盖了原始内容）
    // 无论如何，页面不应显示管理后台的 "用户管理" 内容
    const bodyText = await page.locator("body").innerText();
    const hasAdminContent =
      bodyText.includes("用户管理") ||
      bodyText.includes("所有用户") ||
      bodyText.includes("用户列表");

    expect(hasAdminContent).toBe(false);
  });

  test("TC-M3-SKL-001: /skills 技能管理页面可访问", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/skills");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: 10_000 });
    expect(page.url()).not.toContain("/login");
  });
});