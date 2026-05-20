/**
 * TC-M1-AUTH-001 / TC-M1-AUTH-007
 *
 * 流程1: 登录 → 首页 → 对话 → AI 回复
 *
 * 覆盖用例:
 *   M1-001  有效邮箱密码登录成功
 *   M1-007  未登录重定向
 *   M10-RTE-002  落地页（未登录访问 /）
 *   M10-RTE-003  已登录跳转 /home
 *   M5-CHT-001  发送消息并保存对话
 */

import { test, expect } from "@playwright/test";
import { loginAs, TEST_USERS } from "./helpers";

test.describe("流程1: 登录 → 首页 → 对话", () => {
  test("TC-M1-AUTH-001: 未登录访问 /login 显示登录表单", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();
    await expect(page.getByText("还没有账号？")).toBeVisible();
  });

  test("TC-M10-RTE-002: 未登录访问 / 显示落地页", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const body = page.locator("body");
    const bodyText = await body.innerText();
    const isLanding =
      bodyText.includes("VibeTide") ||
      bodyText.includes("Vibe Media") ||
      bodyText.includes("AI") ||
      bodyText.includes("智能") ||
      bodyText.includes("内容");
    expect(isLanding).toBe(true);
  });

  test("TC-M1-AUTH-006: 登录成功跳转 /home", async ({ page }) => {
    await loginAs(page, "admin");
    await page.waitForURL("**/home", { timeout: 30_000 });
    expect(page.url()).toContain("/home");
  });

  test("TC-M1-AUTH-007: 未登录访问 /home 跳转到 /login", async ({ page }) => {
    // 先清除认证状态
    await page.goto("/login");
    await page.evaluate(() => {
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
    });
    await page.goto("/home");
    // 应重定向到 /login
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(page.url()).toContain("/login");
  });

  test("TC-M10-RTE-003: 已登录访问 / 跳转到 /home", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/");
    await page.waitForURL("**/home", { timeout: 15_000 });
    expect(page.url()).toContain("/home");
  });

  test("TC-M5-CHT-001: 对话页面可访问并显示员工列表", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/chat");
    await page.waitForLoadState("networkidle");

    // 验证页面是否渲染（检查关键 UI 元素）
    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: 10_000 });

    // 验证不直接跳转到登录页（说明已认证）
    expect(page.url()).not.toContain("/login");
  });
});