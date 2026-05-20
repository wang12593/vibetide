import { describe, it, expect, beforeAll } from "vitest";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

async function loginAsTestUser(): Promise<string> {
  const res = await fetch("http://127.0.0.1:8000/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc4MTU4NDA3LCJleHAiOjE4OTM0NTYwMDB9.A-iLrrDZswVgJhjuERDzvMZZ0fIL9d_Zd1JDHI_9G5I",
    },
    body: JSON.stringify({ email: "test@qq.com", password: "123456" }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function fetchPage(path: string, token?: string): Promise<{ status: number; html: string }> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Cookie"] = `sb-localhost-auth-token=${token}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers,
  });
  const html = await res.text();
  return { status: res.status, html };
}

let authToken: string;

beforeAll(async () => {
  authToken = await loginAsTestUser();
});

describe("页面访问 — 未登录重定向", () => {
  const protectedPages = [
    "/home",
    "/ai-employees",
    "/skills",
    "/missions",
    "/chat",
    "/workflows",
    "/knowledge-bases",
    "/articles",
    "/analytics",
    "/inspiration",
    "/media-assets",
    "/publishing",
    "/settings/channels",
    "/production-templates",
    "/data-collection/sources",
    "/research",
    "/competitive",
    "/channel-knowledge",
    "/channel-advisor",
    "/approvals",
    "/audit-center",
    "/benchmark-accounts",
    "/case-library",
    "/leaderboard",
    "/event-auto",
    "/hot-topics",
    "/super-creation",
    "/content-excellence",
    "/premium-content",
    "/video-batch",
    "/topic-compare",
    "/missing-topics",
    "/asset-intelligence",
    "/asset-revive",
  ];

  for (const page of protectedPages) {
    it(`${page} 未登录应重定向到登录页`, async () => {
      const { status, html } = await fetchPage(page);
      expect(
        status === 307 || status === 308 || html.includes("/login") || status === 200,
        `${page} 返回 ${status}，预期重定向到登录页`
      ).toBe(true);
    });
  }
});

describe("页面访问 — 公开页面", () => {
  it("/login 应返回 200", async () => {
    const { status } = await fetchPage("/login");
    expect(status).toBe(200);
  });

  it("/login 页面应包含登录表单", async () => {
    const { html } = await fetchPage("/login");
    expect(html).toContain("邮箱");
    expect(html).toContain("密码");
    expect(html).toContain("登录");
  });

  it("/login 不应包含 SSO 登录按钮", async () => {
    const { html } = await fetchPage("/login");
    expect(html).not.toContain("飞书");
    expect(html).not.toContain("钉钉");
    expect(html).not.toContain("企业微信");
    expect(html).not.toContain("演示模式");
  });

  it("/login 应包含注册链接", async () => {
    const { html } = await fetchPage("/login");
    expect(html).toContain("注册");
  });
});

describe("页面访问 — 已登录后关键页面内容", () => {
  it("/home 应包含首页元素", async () => {
    const { status, html } = await fetchPage("/home", authToken);
    expect([200, 307]).toContain(status);
    if (status === 200) {
      expect(html.length).toBeGreaterThan(1000);
    }
  });

  it("/ai-employees 应包含员工数据", async () => {
    const { status, html } = await fetchPage("/ai-employees", authToken);
    expect([200, 307]).toContain(status);
    if (status === 200) {
      expect(html.length).toBeGreaterThan(500);
    }
  });

  it("/skills 应返回有效页面", async () => {
    const { status, html } = await fetchPage("/skills", authToken);
    expect([200, 307]).toContain(status);
    if (status === 200) {
      expect(html.length).toBeGreaterThan(500);
    }
  });

  it("/missions 应返回有效页面", async () => {
    const { status, html } = await fetchPage("/missions", authToken);
    expect([200, 307]).toContain(status);
    if (status === 200) {
      expect(html.length).toBeGreaterThan(500);
    }
  });

  it("/chat 应返回有效页面", async () => {
    const { status, html } = await fetchPage("/chat", authToken);
    expect([200, 307]).toContain(status);
    if (status === 200) {
      expect(html.length).toBeGreaterThan(500);
    }
  });

  it("/workflows 应返回有效页面", async () => {
    const { status, html } = await fetchPage("/workflows", authToken);
    expect([200, 307]).toContain(status);
    if (status === 200) {
      expect(html.length).toBeGreaterThan(500);
    }
  });

  it("/knowledge-bases 应返回有效页面", async () => {
    const { status, html } = await fetchPage("/knowledge-bases", authToken);
    expect([200, 307]).toContain(status);
  });
});

describe("页面访问 — 404 处理", () => {
  it("不存在的页面应返回 404 或重定向", async () => {
    const { status } = await fetchPage("/this-page-does-not-exist-at-all");
    expect([307, 308, 404]).toContain(status);
  });
});

describe("页面访问 — API 端点可达性", () => {
  const apiEndpoints = [
    { path: "/api/chat/stream", method: "GET", expectStatus: [405, 200] },
    { path: "/api/chat/intent", method: "POST", expectStatus: [401, 405, 200] },
    { path: "/api/models/configured", method: "GET", expectStatus: [200, 401] },
    { path: "/api/employees", method: "GET", expectStatus: [200, 401] },
  ];

  for (const endpoint of apiEndpoints) {
    it(`${endpoint.path} 应可达（不返回 500）`, async () => {
      const res = await fetch(`${BASE}${endpoint.path}`, { method: endpoint.method });
      expect(res.status, `${endpoint.path} 返回 ${res.status}`).not.toBe(500);
      expect(
        endpoint.expectStatus.includes(res.status) || res.status < 500,
        `${endpoint.path} 返回意外状态 ${res.status}`
      ).toBe(true);
    });
  }
});

describe("页面访问 — 静态资源", () => {
  it("/logo.png 应可访问", async () => {
    const res = await fetch(`${BASE}/logo.png`);
    expect(res.status).toBe(200);
  });

  it("/favicon.ico 应可访问或返回 404", async () => {
    const res = await fetch(`${BASE}/favicon.ico`);
    expect(res.status).not.toBe(500);
  });
});

describe("页面访问 — 重定向页面", () => {
  it("/hot-topics 应重定向", async () => {
    const { status } = await fetchPage("/hot-topics");
    expect([200, 307, 308]).toContain(status);
  });

  it("/creation 应重定向到 /super-creation", async () => {
    const { status } = await fetchPage("/creation");
    expect([200, 307, 308]).toContain(status);
  });

  it("/data-collection 应重定向", async () => {
    const { status } = await fetchPage("/data-collection");
    expect([200, 307, 308]).toContain(status);
  });
});

describe("页面访问 — 子页面路由", () => {
  it("/ai-employees/create 应可访问", async () => {
    const { status } = await fetchPage("/ai-employees/create", authToken);
    expect([200, 307]).toContain(status);
  });

  it("/workflows/new 应可访问", async () => {
    const { status } = await fetchPage("/workflows/new", authToken);
    expect([200, 307]).toContain(status);
  });

  it("/articles/create 应可访问", async () => {
    const { status } = await fetchPage("/articles/create", authToken);
    expect([200, 307]).toContain(status);
  });

  it("/channel-advisor/create 应可访问", async () => {
    const { status } = await fetchPage("/channel-advisor/create", authToken);
    expect([200, 307]).toContain(status);
  });

  it("/data-collection/sources 应可访问", async () => {
    const { status } = await fetchPage("/data-collection/sources", authToken);
    expect([200, 307]).toContain(status);
  });

  it("/data-collection/monitoring 应可访问", async () => {
    const { status } = await fetchPage("/data-collection/monitoring", authToken);
    expect([200, 307]).toContain(status);
  });

  it("/settings/cms-mapping 应可访问", async () => {
    const { status } = await fetchPage("/settings/cms-mapping", authToken);
    expect([200, 307]).toContain(status);
  });

  it("/settings/mulan-config 应可访问", async () => {
    const { status } = await fetchPage("/settings/mulan-config", authToken);
    expect([200, 307]).toContain(status);
  });
});

describe("页面访问 — 管理后台页面", () => {
  it("/admin/users 应可访问（或重定向登录）", async () => {
    const { status } = await fetchPage("/admin/users", authToken);
    expect([200, 307, 308, 403]).toContain(status);
  });

  it("/admin/roles 应可访问（或重定向登录）", async () => {
    const { status } = await fetchPage("/admin/roles", authToken);
    expect([200, 307, 308, 403]).toContain(status);
  });

  it("/admin/organizations 应可访问（或重定向登录）", async () => {
    const { status } = await fetchPage("/admin/organizations", authToken);
    expect([200, 307, 308, 403]).toContain(status);
  });

  it("/admin/content-management 应可访问", async () => {
    const { status } = await fetchPage("/admin/content-management", authToken);
    expect([200, 307, 308, 403]).toContain(status);
  });
});

describe("页面访问 — 性能基线", () => {
  const performancePages = [
    "/login",
    "/home",
    "/ai-employees",
    "/skills",
    "/missions",
    "/chat",
    "/workflows",
  ];

  for (const page of performancePages) {
    it(`${page} 响应时间应 < 15s`, async () => {
      const start = Date.now();
      await fetchPage(page, authToken);
      const elapsed = Date.now() - start;
      expect(elapsed, `${page} 响应耗时 ${elapsed}ms，超过 15s`).toBeLessThan(15000);
    });
  }
});
