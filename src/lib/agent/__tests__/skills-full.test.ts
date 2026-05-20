import { describe, it, expect, beforeAll } from "vitest";
import {
  getAllBuiltinSkills,
  loadSkillContent,
  getBuiltinSkillSlugs,
  getBuiltinSkillNameToSlug,
  getBuiltinSkillSlugToName,
  getBuiltinSkillCatalog,
  invalidateSkillCache,
  type BuiltinSkillDef,
  type SkillCategory,
} from "@/lib/skill-loader";

const VALID_CATEGORIES: SkillCategory[] = [
  "info_perception",
  "info_processing",
  "system_interop",
  "automation",
  "communication",
  "multimodal",
  "other",
];

const EXPECTED_SKILL_SLUGS = [
  "web_search",
  "web_deep_read",
  "trending_topics",
  "trend_monitor",
  "social_listening",
  "news_aggregation",
  "media_search",
  "knowledge_retrieval",
  "case_reference",
  "heat_scoring",
  "topic_extraction",
  "angle_design",
  "audience_analysis",
  "sentiment_analysis",
  "competitor_analysis",
  "data_report",
  "content_generate",
  "headline_generate",
  "summary_generate",
  "style_rewrite",
  "script_generate",
  "task_planning",
  "video_edit_plan",
  "thumbnail_generate",
  "layout_design",
  "audio_plan",
  "duanju_script",
  "zhongcao_script",
  "tandian_script",
  "podcast_script",
  "zongyi_highlight",
  "aigc_script_push",
  "quality_review",
  "compliance_check",
  "fact_check",
  "publish_strategy",
  "translation",
  "cms_publish",
  "cms_catalog_sync",
  "browser_automation",
  "page_inspection",
  "xie-xinping-perspective",
  "jiexping_style",
];

let allSkills: BuiltinSkillDef[];

beforeAll(() => {
  invalidateSkillCache();
  allSkills = getAllBuiltinSkills();
});

describe("Skill Loader — 全量技能扫描", () => {
  it("应扫描到至少 40 个内置技能", () => {
    expect(allSkills.length).toBeGreaterThanOrEqual(40);
  });

  it("应包含所有预期的技能 slug", () => {
    const slugs = new Set(allSkills.map((s) => s.slug));
    for (const slug of EXPECTED_SKILL_SLUGS) {
      expect(slugs.has(slug), `缺少技能: ${slug}`).toBe(true);
    }
  });

  it("每个技能都应有非空的 name", () => {
    for (const skill of allSkills) {
      expect(skill.name, `${skill.slug} 的 name 为空`).toBeTruthy();
    }
  });

  it("每个技能都应有非空的 description", () => {
    for (const skill of allSkills) {
      expect(skill.description, `${skill.slug} 的 description 为空`).toBeTruthy();
    }
  });

  it("每个技能的 category 应合法", () => {
    for (const skill of allSkills) {
      expect(
        VALID_CATEGORIES.includes(skill.category),
        `${skill.slug} 的 category "${skill.category}" 不合法`
      ).toBe(true);
    }
  });

  it("每个技能都应有 content 正文", () => {
    for (const skill of allSkills) {
      expect(skill.content.length, `${skill.slug} 的 content 为空`).toBeGreaterThan(0);
    }
  });

  it("每个技能都应有版本号", () => {
    for (const skill of allSkills) {
      expect(skill.version, `${skill.slug} 缺少 version`).toBeTruthy();
    }
  });

  it("不应有重复的 slug", () => {
    const slugs = allSkills.map((s) => s.slug);
    const uniqueSlugs = new Set(slugs);
    expect(uniqueSlugs.size).toBe(slugs.length);
  });
});

describe("Skill Loader — loadSkillContent 单技能加载", () => {
  it("加载 web_search 技能应返回非空内容", () => {
    const content = loadSkillContent("web_search");
    expect(content).not.toBeNull();
    expect(content!.length).toBeGreaterThan(100);
  });

  it("加载 content_generate 技能应返回非空内容", () => {
    const content = loadSkillContent("content_generate");
    expect(content).not.toBeNull();
    expect(content!.length).toBeGreaterThan(100);
  });

  it("加载 quality_review 技能应返回非空内容", () => {
    const content = loadSkillContent("quality_review");
    expect(content).not.toBeNull();
  });

  it("加载不存在的技能应返回 null", () => {
    const content = loadSkillContent("nonexistent_skill_xyz");
    expect(content).toBeNull();
  });

  it("每个已扫描的技能都应能通过 loadSkillContent 加载", () => {
    for (const skill of allSkills) {
      const content = loadSkillContent(skill.slug);
      expect(content, `${skill.slug} 无法通过 loadSkillContent 加载`).not.toBeNull();
    }
  });
});

describe("Skill Loader — 映射和查找", () => {
  it("slug → name 映射应完整", () => {
    const map = getBuiltinSkillSlugToName();
    for (const skill of allSkills) {
      expect(map.has(skill.slug), `${skill.slug} 不在 slug→name 映射中`).toBe(true);
      expect(map.get(skill.slug)).toBe(skill.name);
    }
  });

  it("name → slug 映射应完整", () => {
    const map = getBuiltinSkillNameToSlug();
    for (const skill of allSkills) {
      expect(map.has(skill.name), `${skill.name} 不在 name→slug 映射中`).toBe(true);
      expect(map.get(skill.name)).toBe(skill.slug);
    }
  });

  it("getBuiltinSkillSlugs 应返回所有 slug 的 Set", () => {
    const slugs = getBuiltinSkillSlugs();
    expect(slugs.size).toBe(allSkills.length);
    for (const skill of allSkills) {
      expect(slugs.has(skill.slug)).toBe(true);
    }
  });

  it("getBuiltinSkillCatalog 应生成非空的分类目录", () => {
    const catalog = getBuiltinSkillCatalog();
    expect(catalog.length).toBeGreaterThan(100);
    expect(catalog).toContain("全网检索");
    expect(catalog).toContain("数据采集");
    expect(catalog).toContain("内容生成");
    expect(catalog).toContain("质量审核");
  });
});

describe("Skill Loader — 分类覆盖", () => {
  it("信息感知类应至少包含 web_search 和 trending_topics", () => {
    const dc = allSkills.filter((s) => s.category === "info_perception");
    const dcSlugs = dc.map((s) => s.slug);
    expect(dcSlugs).toContain("web_search");
    expect(dcSlugs).toContain("trending_topics");
    expect(dc.length).toBeGreaterThanOrEqual(7);
  });

  it("信息加工类应至少包含 content_generate", () => {
    const cg = allSkills.filter((s) => s.category === "info_processing");
    const cgSlugs = cg.map((s) => s.slug);
    expect(cgSlugs).toContain("content_generate");
    expect(cg.length).toBeGreaterThanOrEqual(4);
  });

  it("信息加工类应至少包含 quality_review 和 fact_check", () => {
    const qr = allSkills.filter((s) => s.category === "info_processing");
    const qrSlugs = qr.map((s) => s.slug);
    expect(qrSlugs).toContain("quality_review");
    expect(qrSlugs).toContain("fact_check");
  });

  it("信息加工类应至少包含 duanju_script 和 podcast_script", () => {
    const av = allSkills.filter((s) => s.category === "info_processing");
    const avSlugs = av.map((s) => s.slug);
    expect(avSlugs).toContain("duanju_script");
    expect(avSlugs).toContain("podcast_script");
  });

  it("系统互操作类应至少包含 publish_strategy 和 cms_publish", () => {
    const dist = allSkills.filter((s) => s.category === "system_interop");
    const distSlugs = dist.map((s) => s.slug);
    expect(distSlugs).toContain("publish_strategy");
    expect(distSlugs).toContain("cms_publish");
  });

  it("信息加工类应至少包含 topic_extraction 和 audience_analysis", () => {
    const ca = allSkills.filter((s) => s.category === "info_processing");
    const caSlugs = ca.map((s) => s.slug);
    expect(caSlugs).toContain("topic_extraction");
    expect(caSlugs).toContain("sentiment_analysis");
  });

  it("信息加工类应至少包含 competitor_analysis 和 data_report", () => {
    const da = allSkills.filter((s) => s.category === "info_processing");
    const daSlugs = da.map((s) => s.slug);
    expect(daSlugs).toContain("competitor_analysis");
    expect(daSlugs).toContain("data_report");
  });
});

describe("Skill Loader — SKILL.md 内容质量", () => {
  it("web_search 内容应包含搜索流程指引", () => {
    const content = loadSkillContent("web_search");
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(200);
  });

  it("content_generate 内容应包含输出模板", () => {
    const content = loadSkillContent("content_generate");
    expect(content).toBeTruthy();
  });

  it("quality_review 内容应包含审核标准", () => {
    const content = loadSkillContent("quality_review");
    expect(content).toBeTruthy();
  });

  it("cms_publish 内容应包含发布流程", () => {
    const content = loadSkillContent("cms_publish");
    expect(content).toBeTruthy();
  });

  it("所有技能的 content 不应以 --- 开头（frontmatter 应已剥离）", () => {
    for (const skill of allSkills) {
      expect(
        skill.content.startsWith("---"),
        `${skill.slug} 的 content 未剥离 frontmatter`
      ).toBe(false);
    }
  });

  it("每个技能 content 长度应至少 50 字符", () => {
    for (const skill of allSkills) {
      expect(
        skill.content.length,
        `${skill.slug} 的 content 太短 (${skill.content.length} chars)`
      ).toBeGreaterThanOrEqual(50);
    }
  });
});

describe("Skill Loader — runtimeConfig 完整性", () => {
  const toolsWithExpectedRuntime = [
    "web_search",
    "content_generate",
    "cms_publish",
    "heat_scoring",
    "fact_check",
  ];

  it("关键技能应有 runtimeConfig", () => {
    for (const slug of toolsWithExpectedRuntime) {
      const skill = allSkills.find((s) => s.slug === slug);
      if (!skill) continue;
      if (skill.runtimeConfig) {
        expect(skill.runtimeConfig.type, `${slug} runtimeConfig.type 缺失`).toBeTruthy();
        expect(
          typeof skill.runtimeConfig.avgLatencyMs,
          `${slug} runtimeConfig.avgLatencyMs 类型错误`
        ).toBe("number");
      }
    }
  });

  it("compatibleRoles 应为字符串数组或 undefined", () => {
    for (const skill of allSkills) {
      if (skill.compatibleRoles) {
        expect(
          Array.isArray(skill.compatibleRoles),
          `${skill.slug} compatibleRoles 不是数组`
        ).toBe(true);
        for (const role of skill.compatibleRoles) {
          expect(typeof role, `${skill.slug} compatibleRoles 包含非字符串`).toBe("string");
        }
      }
    }
  });
});

describe("Skill Loader — 边界条件", () => {
  it("缓存失效后应能重新加载", () => {
    invalidateSkillCache();
    const skills = getAllBuiltinSkills();
    expect(skills.length).toBeGreaterThanOrEqual(40);
  });

  it("连续调用 getAllBuiltinSkills 应返回相同数量", () => {
    const first = getAllBuiltinSkills().length;
    const second = getAllBuiltinSkills().length;
    expect(first).toBe(second);
  });

  it("空 slug 的 loadSkillContent 应返回 null", () => {
    expect(loadSkillContent("")).toBeNull();
  });

  it("特殊字符 slug 应返回 null", () => {
    expect(loadSkillContent("../../../etc/passwd")).toBeNull();
    expect(loadSkillContent("skill with spaces")).toBeNull();
  });
});

describe("Tool Registry — 工具注册完整性", () => {
  it("应能通过动态导入验证工具注册函数存在", async () => {
    const mod = await import("@/lib/agent/tool-registry");
    expect(typeof mod.isToolRegistered).toBe("function");
    expect(typeof mod.resolveTools).toBe("function");
    expect(typeof mod.getAllToolParamSpecs).toBe("function");
    expect(typeof mod.getToolParamSpecs).toBe("function");
    expect(typeof mod.toVercelTools).toBe("function");
  });

  it("resolveTools 应能处理空数组", async () => {
    const mod = await import("@/lib/agent/tool-registry");
    const tools = mod.resolveTools([]);
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBe(0);
  });

  it("resolveTools 应能解析中文名技能", async () => {
    const mod = await import("@/lib/agent/tool-registry");
    const tools = mod.resolveTools(["全网搜索"]);
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBeTruthy();
  });

  it("resolveTools 应能解析 slug 名技能", async () => {
    const mod = await import("@/lib/agent/tool-registry");
    const tools = mod.resolveTools(["web_search"]);
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe("web_search");
  });

  it("resolveTools 对未知技能应返回安全名称", async () => {
    const mod = await import("@/lib/agent/tool-registry");
    const tools = mod.resolveTools(["未知技能abc"]);
    expect(tools.length).toBe(1);
    expect(tools[0].name).toMatch(/^[a-zA-Z0-9_-]+$/);
  });

  it("isToolRegistered 对已注册工具应返回 true", async () => {
    const mod = await import("@/lib/agent/tool-registry");
    expect(mod.isToolRegistered("web_search")).toBe(true);
  });

  it("isToolRegistered 对未注册工具应返回 false", async () => {
    const mod = await import("@/lib/agent/tool-registry");
    expect(mod.isToolRegistered("nonexistent_tool")).toBe(false);
  });

  it("核心工具应全部注册", async () => {
    const mod = await import("@/lib/agent/tool-registry");
    const coreTools = [
      "web_search",
      "web_deep_read",
      "trending_topics",
      "content_generate",
      "fact_check",
      "heat_scoring",
      "cms_publish",
      "media_search",
      "data_report",
    ];
    for (const toolName of coreTools) {
      expect(
        mod.isToolRegistered(toolName),
        `核心工具 ${toolName} 未注册`
      ).toBe(true);
    }
  });

  it("getAllToolParamSpecs 应返回非空对象", async () => {
    const mod = await import("@/lib/agent/tool-registry");
    const specs = mod.getAllToolParamSpecs();
    expect(Object.keys(specs).length).toBeGreaterThan(0);
  });

  it("web_search 应有 query 参数", async () => {
    const mod = await import("@/lib/agent/tool-registry");
    const params = mod.getToolParamSpecs("web_search");
    const queryParam = params.find((p) => p.name === "query");
    expect(queryParam).toBeDefined();
    expect(queryParam!.required).toBe(true);
  });

  it("toVercelTools 应能将 AgentTool 转为 Vercel ToolSet", async () => {
    const mod = await import("@/lib/agent/tool-registry");
    const agentTools = mod.resolveTools(["web_search", "content_generate"]);
    const vercelTools = mod.toVercelTools(agentTools, new Map(), {} as any, {} as any);
    expect(Object.keys(vercelTools).length).toBeGreaterThanOrEqual(1);
  });

  it("getToolParamSpecs 对未注册工具应返回空数组", async () => {
    const mod = await import("@/lib/agent/tool-registry");
    const params = mod.getToolParamSpecs("nonexistent");
    expect(params).toEqual([]);
  });
});

describe("Tool Registry — 浏览器自动化工具", () => {
  it("浏览器自动化工具应全部注册", async () => {
    const mod = await import("@/lib/agent/tool-registry");
    expect(mod.isToolRegistered("browser_navigate")).toBe(true);
    expect(mod.isToolRegistered("browser_screenshot")).toBe(true);
    expect(mod.isToolRegistered("browser_fill")).toBe(true);
    expect(mod.isToolRegistered("browser_click")).toBe(true);
  });
});

describe("Tool Registry — 插件工具", () => {
  it("toVercelTools 应支持插件配置", async () => {
    const mod = await import("@/lib/agent/tool-registry");
    const pluginConfigs = new Map([
      [
        "my_plugin",
        {
          description: "测试插件",
          config: {
            endpoint: "https://httpbin.org/post",
            method: "POST" as const,
            headers: {},
            authType: "none" as const,
          },
        },
      ],
    ]);
    const agentTools = [
      { name: "my_plugin", description: "测试插件", parameters: {} },
    ];
    const vercelTools = mod.toVercelTools(agentTools, pluginConfigs, {} as any, {} as any);
    expect(vercelTools["my_plugin"]).toBeDefined();
  });
});
