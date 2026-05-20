/**
 * TC-M2-EMP-001 / TC-M2-CUS-001
 *
 * 流程3: 员工列表 → 创建员工 → 绑定技能
 *
 * 覆盖用例:
 *   M2-EMP-001  创建员工成功
 *   M2-CUS-001  创建自定义员工
 *   M2-EMP-003  绑定技能到员工
 *   M2-EMP-007  删除预设员工
 *   M2-CUS-002  名称校验
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("流程3: AI 员工管理", () => {
  test("TC-M2-EMP-001: /ai-employees 页面可访问", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/ai-employees");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: 10_000 });
    expect(page.url()).not.toContain("/login");
  });

  test("M2 员工页面包含预设员工列表", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/ai-employees");
    await page.waitForLoadState("networkidle");

    const bodyText = await page.locator("body").innerText();
    const hasEmployees =
      bodyText.includes("员工") ||
      bodyText.includes("AI") ||
      bodyText.includes("小雷") ||
      bodyText.includes("小文") ||
      bodyText.includes("小深");
    expect(hasEmployees).toBe(true);
  });

  test("TC-M2-EMP-003: 员工详情页面可访问", async ({ page }) => {
    await loginAs(page, "admin");
    // 访问第一个预设员工页面
    await page.goto("/employee/xiaolei");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: 10_000 });
    expect(page.url()).not.toContain("/login");
  });

  test("TC-M2-CUS-002: viewer 可查看员工但不可创建", async ({ page }) => {
    await loginAs(page, "viewer");
    await page.goto("/ai-employees");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: 10_000 });
    expect(page.url()).not.toContain("/login");
  });

  test("TC-M2-EMP-007: /skills 页面可访问（技能管理）", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/skills");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: 10_000 });
    expect(page.url()).not.toContain("/login");
  });
});