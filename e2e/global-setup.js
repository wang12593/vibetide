/**
 * Playwright 全局 Setup
 *
 * 在全部测试开始前，使用 Supabase Admin API (service_role key)
 * 重建所有 E2E 测试用户，绕过 email 确认。
 * 流程: 列出已有用户 → 删除测试用户 → 重新创建 (email_confirm: true)
 *
 * 从 .env.local 读取 SUPABASE_URL 和 SERVICE_ROLE_KEY
 */
const { config } = require("dotenv");
const { resolve } = require("path");

config({ path: resolve(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const AUTH_HEADERS = {
  "Content-Type": "application/json",
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
};

const TEST_USERS = [
  { email: "admin@test.com", password: "Test123!", user_metadata: { display_name: "管理员" } },
  { email: "editor@test.com", password: "Test123!", user_metadata: { display_name: "编辑" } },
  { email: "viewer@test.com", password: "Test123!", user_metadata: { display_name: "观察者" } },
  { email: "org2@test.com", password: "Test123!", user_metadata: { display_name: "组织B用户" } },
];

const testEmails = new Set(TEST_USERS.map((u) => u.email));

async function adminApi(path, options) {
  const url = `${SUPABASE_URL}${path}`;
  const res = await fetch(url, { headers: AUTH_HEADERS, ...options });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

async function recreateUsers() {
  // 1. 列出所有已有用户
  const { ok, body } = await adminApi("/auth/v1/admin/users", { method: "GET" });
  if (!ok || !body || !body.users) {
    console.warn(`[setup] 无法列出用户 (${body?.msg ?? "unknown"})，直接创建`);
    for (const u of TEST_USERS) {
      await createUser(u.email, u.password, u.user_metadata);
    }
    return;
  }

  // 2. 找到我们的测试用户并删除
  const toDelete = body.users.filter((u) => testEmails.has(u.email));
  for (const u of toDelete) {
    console.log(`[setup] 删除已有用户 ${u.email} (${u.id})`);
    await adminApi(`/auth/v1/admin/users/${u.id}`, { method: "DELETE" });
  }

  // 3. 重新创建（带 email_confirm: true）
  for (const u of TEST_USERS) {
    await createUser(u.email, u.password, u.user_metadata);
  }
}

async function createUser(email, password, userMetadata) {
  const { ok, body } = await adminApi("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: userMetadata }),
  });
  if (ok) {
    console.log(`[setup] 用户 ${email} 创建成功 (email_confirm=true)`);
  } else {
    console.warn(`[setup] 创建用户 ${email} 失败:`, JSON.stringify(body));
  }
}

async function globalSetup() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.warn("[setup] 缺少 SUPABASE_URL 或 SERVICE_ROLE_KEY，跳过用户创建");
    return;
  }

  console.log("[setup] 重建 E2E 测试用户...");
  await recreateUsers();
  console.log("[setup] E2E 测试用户准备完毕");
}

module.exports = globalSetup;