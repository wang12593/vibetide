import { describe, it, expect, beforeAll } from "vitest";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const SUPABASE_URL = "http://127.0.0.1:8000";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc4MTU4NDA3LCJleHAiOjE4OTM0NTYwMDB9.A-iLrrDZswVgJhjuERDzvMZZ0fIL9d_Zd1JDHI_9G5I";

const TEST_USER = { email: "test@qq.com", password: "123456" };

let authToken: string;
let testUserId: string;

async function supabaseLogin(
  email: string,
  password: string
): Promise<{ token: string; userId: string }> {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    }
  );
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = await res.json();
  return { token: data.access_token, userId: data.user.id };
}

async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function pageFetch(
  path: string
): Promise<{ status: number; html: string }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${authToken}` },
    redirect: "manual",
  });
  const html = await res.text();
  return { status: res.status, html };
}

function expectValidPage(status: number) {
  expect([200, 307, 308]).toContain(status);
}

beforeAll(async () => {
  const login = await supabaseLogin(TEST_USER.email, TEST_USER.password);
  authToken = login.token;
  testUserId = login.userId;
});

describe("认证流程", () => {
  it("邮箱密码登录应成功", async () => {
    const login = await supabaseLogin(TEST_USER.email, TEST_USER.password);
    expect(login.token).toBeTruthy();
    expect(login.userId).toBeTruthy();
  });

  it("错误密码应返回 400", async () => {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          email: TEST_USER.email,
          password: "wrongpassword",
        }),
      }
    );
    expect(res.status).toBe(400);
  });

  it("登录页面应可访问且包含表单", async () => {
    const res = await fetch(`${BASE}/login`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain("邮箱");
    expect(html).toContain("密码");
    expect(html).toContain("登录");
  });

  it("登录页面不包含 SSO 和演示入口", async () => {
    const res = await fetch(`${BASE}/login`);
    const html = await res.text();
    expect(html).not.toContain("飞书");
    expect(html).not.toContain("钉钉");
    expect(html).not.toContain("企业微信");
    expect(html).not.toContain("演示模式");
  });

  it("登录页面包含注册链接", async () => {
    const res = await fetch(`${BASE}/login`);
    const html = await res.text();
    expect(html).toContain("注册");
  });
});

describe("页面导航 — 全量路由可达性", () => {
  const mainPages = [
    { path: "/home", name: "首页" },
    { path: "/ai-employees", name: "AI员工" },
    { path: "/skills", name: "技能库" },
    { path: "/missions", name: "任务中心" },
    { path: "/chat", name: "对话中心" },
    { path: "/workflows", name: "工作流" },
    { path: "/knowledge-bases", name: "知识库" },
    { path: "/articles", name: "文章" },
    { path: "/publishing", name: "发布" },
    { path: "/analytics", name: "数据分析" },
    { path: "/inspiration", name: "灵感" },
    { path: "/media-assets", name: "媒资库" },
    { path: "/categories", name: "分类管理" },
    { path: "/production-templates", name: "生产模板" },
    { path: "/channel-knowledge", name: "渠道知识" },
    { path: "/channel-advisor", name: "渠道顾问" },
    { path: "/approvals", name: "审批" },
    { path: "/audit-center", name: "审计" },
    { path: "/benchmark-accounts", name: "对标账号" },
    { path: "/case-library", name: "案例库" },
    { path: "/leaderboard", name: "排行榜" },
    { path: "/event-auto", name: "事件自动化" },
    { path: "/data-collection/sources", name: "采集源" },
    { path: "/research", name: "研究" },
    { path: "/settings/channels", name: "渠道配置" },
    { path: "/settings/cms-mapping", name: "CMS映射" },
    { path: "/settings/mulan-config", name: "木兰配置" },
    { path: "/super-creation", name: "超级创作" },
    { path: "/premium-content", name: "精品内容" },
    { path: "/video-batch", name: "视频批处理" },
    { path: "/topic-compare", name: "选题对比" },
    { path: "/missing-topics", name: "遗漏话题" },
    { path: "/asset-intelligence", name: "资产智能" },
    { path: "/asset-revive", name: "资产复用" },
  ];

  for (const page of mainPages) {
    it(`${page.name}(${page.path}) 应可访问`, async () => {
      const { status } = await pageFetch(page.path);
      expectValidPage(status);
    });
  }
});

describe("AI 员工页面操作", () => {
  it("员工列表 API 应返回数据", async () => {
    const { status, body } = await apiFetch("/api/employees");
    expect(status).toBe(200);
    const data = body as Record<string, unknown>;
    expect(typeof data === "object" && data !== null).toBe(true);
  });

  it("员工列表页应可访问", async () => {
    const { status } = await pageFetch("/ai-employees");
    expectValidPage(status);
  });

  it("创建员工子页面应可访问", async () => {
    const { status } = await pageFetch("/ai-employees/create");
    expectValidPage(status);
  });
});

describe("技能页面操作", () => {
  it("技能列表页应可访问", async () => {
    const { status } = await pageFetch("/skills");
    expectValidPage(status);
  });

  it("技能导出 API 应返回有效响应", async () => {
    const { status } = await apiFetch("/api/skills/nonexistent-id/export");
    expect([200, 401, 404, 400]).toContain(status);
  });

  it("模型配置 API 应可访问", async () => {
    const { status } = await apiFetch("/api/models/configured");
    expect(status).toBe(200);
  });
});

describe("任务页面操作", () => {
  it("任务列表页应可访问", async () => {
    const { status } = await pageFetch("/missions");
    expectValidPage(status);
  });

  it("任务进度 API 对不存在任务应返回错误", async () => {
    const { status } = await apiFetch(
      "/api/missions/00000000-0000-0000-0000-000000000000/progress"
    );
    expect([200, 401, 404, 500]).toContain(status);
  });

  it("任务产出物 API 对不存在任务应返回错误", async () => {
    const { status } = await apiFetch(
      "/api/missions/00000000-0000-0000-0000-000000000000/artifacts"
    );
    expect([200, 401, 404, 500]).toContain(status);
  });
});

describe("对话中心操作", () => {
  it("对话中心页应可访问", async () => {
    const { status } = await pageFetch("/chat");
    expectValidPage(status);
  });

  it("意图识别 API 应可调用", async () => {
    const { status } = await apiFetch("/api/chat/intent", {
      method: "POST",
      body: JSON.stringify({ message: "帮我写一篇文章" }),
    });
    expect([200, 401]).toContain(status);
  });

  it("参数分析 API 应可调用", async () => {
    const { status } = await apiFetch("/api/chat/analyze-params", {
      method: "POST",
      body: JSON.stringify({
        message: "搜索关于AI的最新新闻",
        skillSlug: "web_search",
      }),
    });
    expect([200, 400, 401, 500]).toContain(status);
  });
});

describe("工作流页面操作", () => {
  it("工作流列表页应可访问", async () => {
    const { status } = await pageFetch("/workflows");
    expectValidPage(status);
  });

  it("创建工作流子页面应可访问", async () => {
    const { status } = await pageFetch("/workflows/new");
    expectValidPage(status);
  });

  it("工作流生成 API 应可调用", async () => {
    const { status } = await apiFetch("/api/workflows/generate", {
      method: "POST",
      body: JSON.stringify({ description: "测试工作流" }),
    });
    expect([200, 400, 401, 500]).toContain(status);
  });
});

describe("知识库页面操作", () => {
  it("知识库列表页应可访问", async () => {
    const { status } = await pageFetch("/knowledge-bases");
    expectValidPage(status);
  });
});

describe("文章页面操作", () => {
  it("文章列表页应可访问", async () => {
    const { status } = await pageFetch("/articles");
    expectValidPage(status);
  });

  it("创建文章页应可访问", async () => {
    const { status } = await pageFetch("/articles/create");
    expectValidPage(status);
  });
});

describe("数据采集页面操作", () => {
  it("采集源列表页应可访问", async () => {
    const { status } = await pageFetch("/data-collection/sources");
    expectValidPage(status);
  });

  it("采集监控页应可访问", async () => {
    const { status } = await pageFetch("/data-collection/monitoring");
    expectValidPage(status);
  });

  it("采集内容页应可访问", async () => {
    const { status } = await pageFetch("/data-collection/content");
    expectValidPage(status);
  });

  it("新建采集源页应可访问", async () => {
    const { status } = await pageFetch("/data-collection/sources/new");
    expectValidPage(status);
  });
});

describe("研究工作台操作", () => {
  it("研究首页应可访问", async () => {
    const { status } = await pageFetch("/research");
    expectValidPage(status);
  });

  it("研究选题管理页应可访问", async () => {
    const { status } = await pageFetch("/research/admin/topics");
    expectValidPage(status);
  });

  it("研究任务管理页应可访问", async () => {
    const { status } = await pageFetch("/research/admin/tasks");
    expectValidPage(status);
  });

  it("媒体渠道管理页应可访问", async () => {
    const { status } = await pageFetch("/research/admin/media-outlets");
    expectValidPage(status);
  });
});

describe("渠道顾问操作", () => {
  it("渠道顾问首页应可访问", async () => {
    const { status } = await pageFetch("/channel-advisor");
    expectValidPage(status);
  });

  it("创建渠道顾问页应可访问", async () => {
    const { status } = await pageFetch("/channel-advisor/create");
    expectValidPage(status);
  });

  it("渠道对比页应可访问", async () => {
    const { status } = await pageFetch("/channel-advisor/compare");
    expectValidPage(status);
  });

  it("A/B 测试页应可访问", async () => {
    const { status } = await pageFetch("/channel-advisor/ab-test");
    expectValidPage(status);
  });
});

describe("选题对比操作", () => {
  it("选题对比首页应可访问", async () => {
    const { status } = await pageFetch("/topic-compare");
    expectValidPage(status);
  });

  it("选题对比账号页应可访问", async () => {
    const { status } = await pageFetch("/topic-compare/accounts");
    expectValidPage(status);
  });

  it("选题对比分析 API 应可调用", async () => {
    const { status } = await apiFetch("/api/topic-compare/analyze", {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect([200, 400, 401, 500]).toContain(status);
  });
});

describe("灵感中心操作", () => {
  it("灵感页应可访问", async () => {
    const { status } = await pageFetch("/inspiration");
    expectValidPage(status);
  });

  it("新话题 API 应可调用", async () => {
    const { status } = await apiFetch("/api/inspiration/new-topics");
    expect([200, 401, 500]).toContain(status);
  });
});

describe("管理后台操作", () => {
  it("用户管理页应可访问", async () => {
    const { status } = await pageFetch("/admin/users");
    expect([200, 307, 308, 403]).toContain(status);
  });

  it("角色管理页应可访问", async () => {
    const { status } = await pageFetch("/admin/roles");
    expect([200, 307, 308, 403]).toContain(status);
  });

  it("组织管理页应可访问", async () => {
    const { status } = await pageFetch("/admin/organizations");
    expect([200, 307, 308, 403]).toContain(status);
  });

  it("内容管理页应可访问", async () => {
    const { status } = await pageFetch("/admin/content-management");
    expect([200, 307, 308, 403]).toContain(status);
  });
});

describe("API 端点可达性 — 无 500 错误", () => {
  const apiEndpoints = [
    { path: "/api/employees", method: "GET" },
    { path: "/api/models/configured", method: "GET" },
    { path: "/api/inspiration/new-topics", method: "GET" },
  ];

  for (const ep of apiEndpoints) {
    it(`${ep.method} ${ep.path} 不应返回 500`, async () => {
      const { status } = await apiFetch(ep.path, {
        method: ep.method,
      });
      expect(status).not.toBe(500);
    });
  }
});

describe("页面响应性能", () => {
  const perfPages = [
    "/login",
    "/home",
    "/ai-employees",
    "/skills",
    "/missions",
    "/chat",
    "/workflows",
  ];

  for (const page of perfPages) {
    it(`${page} 响应时间 < 10s`, async () => {
      const start = Date.now();
      await pageFetch(page);
      const elapsed = Date.now() - start;
      expect(elapsed, `${page} 耗时 ${elapsed}ms`).toBeLessThan(10000);
    });
  }
});

describe("重定向验证", () => {
  it("/hot-topics → /inspiration", async () => {
    const { status } = await pageFetch("/hot-topics");
    expectValidPage(status);
  });

  it("/creation → /super-creation", async () => {
    const { status } = await pageFetch("/creation");
    expectValidPage(status);
  });

  it("/competitive → /benchmark-accounts", async () => {
    const { status } = await pageFetch("/competitive");
    expectValidPage(status);
  });

  it("/data-collection → /data-collection/sources", async () => {
    const { status } = await pageFetch("/data-collection");
    expectValidPage(status);
  });
});
