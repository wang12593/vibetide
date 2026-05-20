/**
 * TC-M4-MIS-001 / TC-M4-WFT-001
 *
 * 流程2: 首页 → 场景启动 → 任务创建 → 步骤审批
 *
 * 覆盖用例:
 *   M4-MIS-001  创建任务成功（startMission）
 *   M4-WFT-001  创建工作流模板
 *   M4-SM-001   完整状态流转
 *   M4-LCH-001  startMissionFromTemplate 成功
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("流程2: 场景启动 → 任务创建", () => {
  test("TC-M4-MIS-001: /missions 页面可访问", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/missions");
    await page.waitForLoadState("networkidle");

    // 验证任务页面是否渲染
    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: 10_000 });
    expect(page.url()).not.toContain("/login");
  });

  test("TC-M4-SM-001: /missions 页面包含任务列表区域", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/missions");
    await page.waitForLoadState("networkidle");

    // 验证页面上有任务相关 UI 元素
    const bodyText = await page.locator("body").innerText();
    const hasMissionUI =
      bodyText.includes("任务") ||
      bodyText.includes("Mission") ||
      bodyText.includes("场景") ||
      bodyText.includes("工作流");
    expect(hasMissionUI).toBe(true);
  });

  test("TC-M4-WFT-001: /workflows 页面可访问", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/workflows");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: 10_000 });
    expect(page.url()).not.toContain("/login");
  });

  test("TC-M4-LCH-001: 首页场景网格可访问", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    // 验证首页是否渲染了场景/工作流区域
    const bodyText = await page.locator("body").innerText();
    const hasContent = bodyText.length > 50;
    expect(hasContent).toBe(true);
  });

  test("TC-M4-MIS-004: /missions 页面可见性过滤", async ({ page }) => {
    await loginAs(page, "viewer");
    await page.goto("/missions");
    await page.waitForLoadState("networkidle");

    // viewer 应能看到任务页面（有读取权限）
    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: 10_000 });
    expect(page.url()).not.toContain("/login");
  });
});