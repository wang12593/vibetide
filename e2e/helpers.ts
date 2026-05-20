import { Page, expect } from "@playwright/test";

/** 测试账号 */
export const TEST_USERS = {
  admin: { email: "admin@test.com", password: "Test123!", displayName: "管理员" },
  editor: { email: "editor@test.com", password: "Test123!", displayName: "编辑" },
  viewer: { email: "viewer@test.com", password: "Test123!", displayName: "观察者" },
  org2: { email: "org2@test.com", password: "Test123!", displayName: "组织B用户" },
} as const;

/**
 * 登录流程
 * 填入邮箱密码 → 点击登录 → 等待跳转到 /home
 * 测试用户由 global-setup.ts 在测试运行前创建
 */
export async function loginAs(page: Page, role: keyof typeof TEST_USERS) {
  const user = TEST_USERS[role];
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "登录" })).toBeVisible({ timeout: 10_000 });

  await page.getByPlaceholder("your@email.com").fill(user.email);
  await page.getByPlaceholder("输入密码").fill(user.password);
  await page.getByRole("button", { name: "登录" }).click();

  await page.waitForURL("**/home", { timeout: 30_000 });
}

/**
 * 等待页面加载完成（网络空闲）
 */
export async function waitForPageReady(page: Page) {
  await page.waitForLoadState("networkidle");
}

/**
 * 验证页面标题（从 PageHeader 组件中查找）
 */
export async function expectPageTitle(page: Page, title: string) {
  await expect(page.locator("h1, h2", { hasText: title }).first()).toBeVisible({
    timeout: 10_000,
  });
}

/**
 * 验证 Toast/通知消息
 */
export async function expectToast(page: Page, text: string) {
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 10_000 });
}

/**
 * 安全点击（等待元素可见后再点击）
 */
export async function safeClick(page: Page, locator: string) {
  const el = page.locator(locator);
  await el.waitFor({ state: "visible", timeout: 10_000 });
  await el.click();
}

/**
 * 安全填写输入框
 */
export async function safeFill(page: Page, placeholder: string, value: string) {
  const input = page.getByPlaceholder(placeholder);
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(value);
}