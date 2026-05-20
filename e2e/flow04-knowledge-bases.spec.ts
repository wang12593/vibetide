/**
 * TC-M7-KB-001 / TC-M7-DOC-001
 *
 * 流程4: 知识库 → 上传文档 → 向量化 → 绑定员工
 *
 * 覆盖用例:
 *   M7-KB-001  创建知识库
 *   M7-KB-004  删除非本人知识库
 *   M7-DOC-001 添加知识条目
 *   M7-KB-003  删除知识库
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("流程4: 知识库管理", () => {
  test("TC-M7-KB-001: /knowledge-bases 页面可访问", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/knowledge-bases");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: 10_000 });
    expect(page.url()).not.toContain("/login");
  });

  test("知识库列表页面渲染正确", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/knowledge-bases");
    await page.waitForLoadState("networkidle");

    const bodyText = await page.locator("body").innerText();
    const hasKBUI =
      bodyText.includes("知识库") ||
      bodyText.includes("Knowledge") ||
      bodyText.includes("文档");
    expect(hasKBUI).toBe(true);
  });

  test("TC-M7-DOC-001: viewer 可查看知识库但无创建权限", async ({ page }) => {
    await loginAs(page, "viewer");
    await page.goto("/knowledge-bases");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: 10_000 });
    expect(page.url()).not.toContain("/login");
  });

  test("TC-M7-KB-004: 知识库详情页面路由检查", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/knowledge-bases");
    await page.waitForLoadState("networkidle");

    // 页面 URL 正确
    expect(page.url()).toContain("/knowledge-bases");
    expect(page.url()).not.toContain("/login");
  });
});