import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { skills, userProfiles } from "@/db/schema";
import { eq, isNotNull } from "drizzle-orm";
import { generateText } from "ai";
import { getLanguageModel } from "@/lib/agent/model-router";

// ---------------------------------------------------------------------------
// System prompt — multi-round conversation + workflow generation
// ---------------------------------------------------------------------------

function buildSystemPrompt(skillCatalog: string): string {
  return `你是 智能协作空间 的工作流规划专家，帮助用户设计自动化内容生产工作流。

## 工作方式

用户描述需求后，你直接生成工作流 JSON。如果用户描述非常简略（少于20字或只有1个关键词），先追问1个关键问题再生成。

### 输出规则

**始终输出纯 JSON 对象**（不需要 markdown 代码块，不要包裹在任何标记中）：

{
  "name": "工作流名称（5字以内）",
  "description": "工作流一句话描述",
  "category": "news|video|analytics|distribution|custom",
  "triggerType": "manual|scheduled",
  "triggerConfig": null,
  "steps": [
    {
      "name": "步骤显示名",
      "skillSlug": "skill_slug（必须使用下方可用技能列表中的 slug）",
      "skillName": "技能中文名",
      "skillCategory": "perception|analysis|generation|production|management|knowledge",
      "description": "该步骤的核心指令，1-2句话，说明做什么+关键约束"
    }
  ]
}

## description 字段要求

每个步骤的 description 是执行时的核心指令，必须具体：
- ❌ "内容创作"、"搜索素材"（太笼统）
- ✅ "基于热点分析，撰写1500字科技评论，语言严谨克制"
- ✅ "抓取微博/知乎/抖音当日科技话题TOP20，筛选热度>80条目"

## 可用技能列表

${skillCatalog}

## 规则

1. 每个步骤必须使用上面列表中的 skillSlug，不能自己编造
2. 步骤数量 2-6 个，按执行顺序排列
3. steps 数组中的每个对象都必须有 name、skillSlug、skillName、skillCategory、description 五个字段
4. category 根据主要内容选择：新闻类选 news，视频类选 video，数据分析选 analytics，推广分发选 distribution，其他选 custom
5. triggerType 为 "manual"（手动触发）或 "scheduled"（定时），定时时 triggerConfig 为 { "cron": "cron表达式", "timezone": "Asia/Shanghai" }，手动时为 null
6. 输出必须是合法 JSON，不要输出任何解释性文字`;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    // Auth
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { messages } = body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response("缺少对话内容", { status: 400 });
    }

    // SSE stream
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: Record<string, unknown>) => {
          try {
            controller.enqueue(
              encoder.encode(
                `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
              )
            );
          } catch {
            // Controller closed
          }
        };

        try {
          send("thinking", { message: "思考中..." });

          const profile = await db.query.userProfiles.findFirst({
            where: eq(userProfiles.id, user.id),
          });
          if (!profile?.organizationId) {
            send("error", { message: "未找到组织信息" });
            controller.close();
            return;
          }

          // Load available skills
          const allSkills = await db
            .select({
              slug: skills.slug,
              name: skills.name,
              category: skills.category,
              description: skills.description,
            })
            .from(skills)
            .where(isNotNull(skills.slug));

          if (allSkills.length === 0) {
            send("error", { message: "未找到可用技能" });
            controller.close();
            return;
          }

          const skillCatalog = allSkills
            .map(
              (s) =>
                `- ${s.slug} - ${s.name}（${s.category}）- ${s.description}`
            )
            .join("\n");

          const validSlugs = new Set(allSkills.map((s) => s.slug));
          const systemPrompt = buildSystemPrompt(skillCatalog);

          // Call LLM with full conversation history
          const result = await generateText({
            model: getLanguageModel({
              provider: "openai",
              model: process.env.OPENAI_MODEL || "Qwen3.5-35B-A3B",
              temperature: 0.4,
              maxTokens: 2048,
            }),
            system: systemPrompt,
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            maxOutputTokens: 2048,
            abortSignal: AbortSignal.timeout(300_000),
          });

          let text = result.text.trim();

          // Detect if response is JSON (workflow generation) or conversation
          // Strip markdown code block if present
          let jsonText = text;
          if (jsonText.startsWith("```")) {
            jsonText = jsonText
              .replace(/^```(?:json)?\s*/, "")
              .replace(/\s*```$/, "");
          }

          let isWorkflowJson = false;
          if (jsonText.startsWith("{")) {
            try {
              const parsed = JSON.parse(jsonText) as {
                name?: string;
                steps?: Array<{
                  name: string;
                  skillSlug: string;
                  skillName: string;
                  skillCategory: string;
                  description: string;
                }>;
                description?: string;
                category?: string;
                triggerType?: string;
                triggerConfig?: {
                  cron?: string;
                  timezone?: string;
                } | null;
              };

              // Check if it looks like a valid workflow spec
              if (parsed.name && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
                isWorkflowJson = true;

                // Validate steps
                parsed.steps = parsed.steps.filter((s) =>
                  validSlugs.has(s.skillSlug)
                );

                const validCategories = [
                  "news",
                  "video",
                  "analytics",
                  "distribution",
                  "custom",
                ];
                if (!parsed.category || !validCategories.includes(parsed.category)) {
                  parsed.category = "custom";
                }
                if (!parsed.triggerType || !["manual", "scheduled"].includes(parsed.triggerType)) {
                  parsed.triggerType = "manual";
                  parsed.triggerConfig = null;
                }

                send("result", parsed as unknown as Record<string, unknown>);
              }
            } catch {
              // Not valid JSON — treat as conversation
              isWorkflowJson = false;
            }
          }

          if (!isWorkflowJson) {
            // Conversational reply
            send("reply", { message: text });
          }
        } catch (err) {
          console.error("[workflows/generate] Error:", err);
          const isTimeout =
            err instanceof Error &&
            (err.name === "TimeoutError" ||
              err.name === "AbortError" ||
              err.message.includes("abort") ||
              err.message.includes("timeout") ||
              err.message.includes("timed out"));
          send("error", {
            message: isTimeout
              ? "生成超时（AI 推理较慢），请稍后重试或简化需求描述"
              : `工作流生成失败: ${err instanceof Error ? err.message : "未知错误"}`,
          });
        } finally {
          try {
            controller.close();
          } catch {
            // Already closed
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[workflows/generate] Unhandled error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal Server Error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
