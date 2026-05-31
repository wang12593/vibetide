import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { aiEmployees, organizations, userProfiles, savedConversations } from "@/db/schema";
import { and, eq, asc } from "drizzle-orm";
import { streamText, stepCountIs } from "ai";
import { getLanguageModel } from "@/lib/agent/model-router";
import { toVercelTools } from "@/lib/agent/tool-registry";
import { assembleAgent } from "@/lib/agent/assembly";
import { getBuiltinSkillSlugToName } from "@/lib/skill-loader";
import { notifyChatMessage } from "@/lib/channels/chat-notifier";
import { resolveRoute, resolveMultiStepRoute, WORKFLOW_ORDER, type ContinuationContext } from "@/lib/chat/group-router";
import { executeSerialPlan, executeParallelPlan, planFromTemplate, type StepExecutor } from "@/lib/chat/group-dispatcher";
import { assembleGroupContext } from "@/lib/agent/assembly";
import { invokeToolDirectly } from "@/lib/agent/tool-registry";
import { extractSearchQuery, resolveWebSearchTimeRange } from "@/lib/chat/search-params";
import { buildEmployeeVisibilityCondition } from "@/lib/dal/visibility-filter";
import { isSuperAdmin } from "@/lib/rbac";

async function resolveOrgId(userId: string | null): Promise<string | null> {
  if (userId) {
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, userId),
    });
    if (profile?.organizationId) return profile.organizationId;
  }
  const defaultOrg = await db.query.organizations.findFirst({
    orderBy: asc(organizations.createdAt),
  });
  return defaultOrg?.id ?? null;
}

/** Friendly Chinese labels for tool names */
const TOOL_LABELS: Record<string, string> = {
  web_search: "正在搜索互联网资料",
  deep_read: "正在深度阅读网页",
  trending_topics: "正在获取全网热榜",
  content_generate: "正在生成内容",
  fact_check: "正在进行事实核查",
  media_search: "正在检索媒资库",
  data_report: "正在生成数据报告",
};

/** Map tool slug -> skill display name */
const TOOL_TO_SKILL: Record<string, string> = Object.fromEntries(
  getBuiltinSkillSlugToName()
);

/** Extract domain from URL */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Extract source domains from tool call results */
function extractSources(toolResult: unknown): string[] {
  if (!toolResult || typeof toolResult !== "object") return [];
  const obj = toolResult as Record<string, unknown>;

  // web_search returns { results: [{ url, source }] }
  if (Array.isArray(obj.results)) {
    const domains = new Set<string>();
    for (const r of obj.results) {
      if (r && typeof r === "object") {
        const item = r as Record<string, unknown>;
        if (typeof item.url === "string") domains.add(extractDomain(item.url));
        else if (typeof item.source === "string") domains.add(item.source);
      }
    }
    return Array.from(domains);
  }

  // deep_read returns { url, ... }
  if (typeof obj.url === "string") {
    return [extractDomain(obj.url)];
  }

  return [];
}

export async function POST(req: Request) {
  try {
    let userId: string | null = null;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
    const isAdmin = userId ? await isSuperAdmin(userId) : false;

    const body = await req.json();
    const { employeeSlug, conversationHistory, conversationId, resumeFromStep, priorStepOutput, originalTargetSlugs } = body as {
      employeeSlug: string;
      conversationHistory: { role: "user" | "assistant"; content: string }[];
      mode?: "mulan" | "direct" | "routed";
      routingContext?: { summary: string; intentType: string; requiredSkills: string[]; userMessage: string; mulanAnalysis: string };
      conversationId?: string;
      resumeFromStep?: number;
      priorStepOutput?: string;
      originalTargetSlugs?: string[];
    };

    if (!conversationHistory?.length) {
      return new Response("缺少必要参数", { status: 400 });
    }

    const isGroupLookup = !!conversationId;
    if (!isGroupLookup && !employeeSlug) {
      return new Response("缺少必要参数", { status: 400 });
    }

    const organizationId = await resolveOrgId(userId);
    if (!organizationId) {
      return new Response("Organization not found", { status: 403 });
    }

    // Check if this is a group chat
    let isGroupChat = false;
    let groupMode: "serial" | "parallel" = "serial";
    if (conversationId) {
      const conv = await db.query.savedConversations.findFirst({
        where: eq(savedConversations.id, conversationId),
      });
      if (conv?.isGroup === 1) {
        isGroupChat = true;
        groupMode = (conv.groupMode as "serial" | "parallel") ?? "serial";
      }
    }

    if (isGroupChat) {
      return handleGroupChat({
        conversationId: conversationId!,
        groupMode,
        organizationId,
        userId,
        conversationHistory,
        encoder: new TextEncoder(),
        resumeFromStep,
        priorStepOutput,
        originalTargetSlugs,
      });
    }

    // Find employee by slug + org
    const employeeRecord = await db.query.aiEmployees.findFirst({
      where: userId
        ? and(
            eq(aiEmployees.slug, employeeSlug),
            buildEmployeeVisibilityCondition({
              userId,
              orgId: organizationId,
              table: aiEmployees,
              isAdmin,
            }),
          )
        : and(
            eq(aiEmployees.slug, employeeSlug),
            eq(aiEmployees.organizationId, organizationId),
          ),
    });
    if (!employeeRecord) {
      return new Response("数字员工不存在或无权操作", { status: 403 });
    }

    // Assemble agent
    let agent;
    try {
      agent = await assembleAgent(employeeRecord.id, undefined, { userId: userId ?? undefined, orgId: organizationId });
    } catch (err) {
      console.error("[chat/stream] assembleAgent failed:", err);
      return new Response(
        `Agent assembly failed: ${err instanceof Error ? err.message : String(err)}`,
        { status: 500 }
      );
    }

    // Use the last 10 messages as context
    const messages = conversationHistory.slice(-10);

    let model;
    try {
      model = getLanguageModel(agent.modelConfig);
    } catch (err) {
      console.error("[chat/stream] getLanguageModel failed:", err);
      return new Response(
        `Model init failed: ${err instanceof Error ? err.message : String(err)}`,
        { status: 500 }
      );
    }

    // Free chat: use agent's own tools (no scenario-specific toolsHint)
    const vercelTools = toVercelTools(agent.tools, agent.pluginConfigs);

    // Anti-hallucination addendum: intent-execute 路径已用 invokeToolDirectly
    // server 端预执行保护；free-chat 路径 LLM 自由度更高，这里至少把"禁止凭
    // 训练数据编造事实"的红线写进 system prompt。
    // 事故参考：tool-registry.ts:1073-1083（输入 "CCBN" 产出 2023 年训练数据
    // 里的虚构新闻）。
    const hasWebSearch = agent.tools.some(
      (t) => t.name === "web_search" || t.name === "trending_topics"
    );
    const antiHallucinationAddendum = hasWebSearch
      ? `

【事实性内容硬约束（最高优先级）】
1. 凡涉及具体事件、日期、数据、人物发言、会议/展会/产品名、新闻报道等**事实性信息**，必须先调用 \`web_search\`（或 \`trending_topics\`）检索最新资料，然后引用工具返回的真实结果作答
2. **禁止**凭训练记忆回答事实问题（你的训练数据可能已过期 1-2 年以上）
3. 真实结果为空时：如实告知"未检索到相关最新内容"并建议用户补充关键词或调整时间范围，**不得**从训练数据里补填任何文章/日期/数据/引用
4. **严禁伪造来源/时间/数据**：不得编造 URL、不得编造媒体名（如"华尔街日报""彭博社"）、不得编造发布时间、阅读量、互动指数、专家姓名
5. 工具返回的结果是唯一真实数据源。即使只有 0-2 条结果，也只引用这些真实结果，**不得**从训练数据补充更多条目来凑数
6. 若用户明确说"不需要搜，你知道就直说"之类，遵从；否则默认走工具检索
7. 违反上述规则将导致输出被标记为无效`
      : "";

    const MAX_INPUT_CHARS = 200000;
    let systemPrompt = agent.systemPrompt + antiHallucinationAddendum;
    let trimmedMessages = messages;
    if (systemPrompt.length > MAX_INPUT_CHARS) {
      systemPrompt = systemPrompt.slice(0, MAX_INPUT_CHARS) + "\n\n(系统提示已截断)";
    }
    while (systemPrompt.length + JSON.stringify(trimmedMessages).length > MAX_INPUT_CHARS && trimmedMessages.length > 1) {
      trimmedMessages = trimmedMessages.slice(1);
    }

    const result = streamText({
      model,
      system: systemPrompt,
      messages: trimmedMessages,
      tools: vercelTools,
      stopWhen: stepCountIs(10),
      maxOutputTokens: 8192,
      temperature: 0.5,
    });

    // Custom SSE stream with structured events (same protocol as /api/scenarios/execute)
    const encoder = new TextEncoder();
    const allSources: string[] = [];
    let referenceCount = 0;
    const usedSkills: { tool: string; skillName: string }[] = [];
    const usedToolSet = new Set<string>();

    // Accumulate the full assistant answer so we can forward the Q&A to any
    // configured external channels (DingTalk / WeChat Work) after streaming.
    let assistantText = "";
    const lastUserMessage =
      [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

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
            // Controller already closed (client disconnected)
          }
        };

        try {
          for await (const part of result.fullStream) {
            switch (part.type) {
              case "tool-call": {
                const label =
                  TOOL_LABELS[part.toolName] ?? `正在执行${part.toolName}`;
                const skillName =
                  TOOL_TO_SKILL[part.toolName] ?? part.toolName;
                if (!usedToolSet.has(part.toolName)) {
                  usedToolSet.add(part.toolName);
                  usedSkills.push({ tool: part.toolName, skillName });
                }
                send("thinking", { tool: part.toolName, label, skillName });
                break;
              }
              case "tool-result": {
                const sources = extractSources(part.output);
                if (sources.length > 0) {
                  for (const s of sources) {
                    if (!allSources.includes(s)) allSources.push(s);
                  }
                  referenceCount += sources.length;
                  send("source", {
                    tool: part.toolName,
                    sources,
                    totalSources: allSources.length,
                    totalReferences: referenceCount,
                  });
                }
                break;
              }
              case "text-delta": {
                assistantText += part.text;
                send("text-delta", { text: part.text });
                break;
              }
              case "finish": {
                send("done", {
                  sources: allSources,
                  referenceCount,
                  finishReason: part.finishReason,
                  skillsUsed: usedSkills,
                });
                break;
              }
            }
          }
        } catch (err) {
          send("error", {
            message: err instanceof Error ? err.message : "未知错误",
          });
        } finally {
          try {
            controller.close();
          } catch {
            // Already closed
          }

          // Fire-and-forget channel sync. Don't await — response stream has
          // already closed to the client; external webhook latency shouldn't
          // delay the function response or fail the chat.
          if (assistantText.trim() && lastUserMessage) {
            void notifyChatMessage({
              organizationId,
              userId: userId ?? "demo-user",
              employeeSlug,
              employeeName:
                employeeRecord.nickname ||
                employeeRecord.name ||
                employeeSlug,
              userMessage: lastUserMessage,
              assistantMessage: assistantText,
              skillsUsed: usedSkills.map((s) => s.skillName),
            });
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
    console.error("[chat/stream] Unhandled route error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal Server Error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

function buildContinuationContext(
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  aiParticipants: string[]
): ContinuationContext {
  const completedSteps: ContinuationContext["completedSteps"] = [];
  const EMPLOYEE_PATTERNS: Array<{ slug: string; patterns: RegExp[] }> = [
    { slug: "xiaolei", patterns: [/小雷/, /热点分析师/, /【小雷/, /热点分析报告/, /实时检索报告/] },
    { slug: "xiaoce", patterns: [/小策/, /选题策划师/, /【小策/] },
    { slug: "xiaozi", patterns: [/小资/, /素材研究员/, /【小资/] },
    { slug: "xiaowen", patterns: [/小文/, /内容创作师/, /【小文/] },
    { slug: "xiaojian", patterns: [/小剪/, /视频制片人/, /【小剪/] },
    { slug: "xiaoshen", patterns: [/小审/, /质量审核官/, /【小审/] },
    { slug: "xiaofa", patterns: [/小发/, /渠道运营师/, /【小发/] },
    { slug: "xiaoshu", patterns: [/小数/, /数据分析师/, /【小数/] },
  ];

  for (const msg of conversationHistory) {
    if (msg.role !== "assistant") continue;
    for (const { slug, patterns } of EMPLOYEE_PATTERNS) {
      if (!aiParticipants.includes(slug)) continue;
      if (patterns.some((p) => p.test(msg.content))) {
        const last = completedSteps[completedSteps.length - 1];
        if (last?.employeeSlug !== slug) {
          completedSteps.push({ employeeSlug: slug, output: msg.content.slice(0, 4000) });
        } else if (!last.output || msg.content.length > last.output.length) {
          last.output = msg.content.slice(0, 4000);
        }
      }
    }
  }

  return { completedSteps };
}

async function handleGroupChat(opts: {
  conversationId: string;
  groupMode: "serial" | "parallel";
  organizationId: string;
  userId: string | null;
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  encoder: TextEncoder;
  resumeFromStep?: number;
  priorStepOutput?: string;
  originalTargetSlugs?: string[];
}): Promise<Response> {
  const { conversationId, groupMode, organizationId, userId, conversationHistory, encoder } = opts;
  const lastUserMessage = [...conversationHistory].reverse().find((m) => m.role === "user")?.content ?? "";

  const participants = await db.query.conversationParticipants.findMany({
    where: (cp, { eq }) => eq(cp.conversationId, conversationId),
  });

  const aiParticipants = participants
    .filter((p) => p.participantType === "ai_employee")
    .map((p) => p.participantId);

  const aiParticipantObjects = participants
    .filter((p) => p.participantType === "ai_employee");

  if (aiParticipants.length === 0) {
    return new Response("群聊中没有 AI 员工", { status: 400 });
  }

  const convRow = await db.query.savedConversations.findFirst({
    where: eq(savedConversations.id, conversationId),
    columns: { metadata: true },
  });
  const convMetadata = convRow?.metadata as Record<string, unknown> | null;
  const intentStepsFromMeta = (convMetadata?.intentSteps as Array<{
    employeeSlug: string;
    employeeName: string;
    taskDescription: string;
    skills: string[];
  }> | null) ?? null;

  const resumeStep = opts.resumeFromStep ?? 0;
  const hasPriorOutput = !!opts.priorStepOutput;
  const savedTargetSlugs = opts.originalTargetSlugs;

  let targetSlugs: string[];
  let effectiveGroupMode: "serial" | "parallel" = groupMode;
  let continuationUpstreamOutput: string | undefined;
  let missingWarning: string | undefined;

  if (savedTargetSlugs && savedTargetSlugs.length > 0 && (resumeStep > 0 || hasPriorOutput)) {
    targetSlugs = [...savedTargetSlugs];
    effectiveGroupMode = "serial";
  } else if (resumeStep > 0 || hasPriorOutput) {
    targetSlugs = WORKFLOW_ORDER.filter((s) => aiParticipants.includes(s));
    effectiveGroupMode = "serial";
  } else {
    const multiStep = resolveMultiStepRoute(lastUserMessage, aiParticipants);

    if (multiStep) {
      const available = multiStep.slugs.filter((s) => aiParticipants.includes(s));
      targetSlugs = available.length >= 2 ? available : multiStep.slugs;
      effectiveGroupMode = "serial";

      if (multiStep.missing.length > 0 && available.length >= 2) {
        const missingNames = multiStep.missing.map((m) => m.task).join("、");
        missingWarning = `⚠️ 当前群聊缺少以下角色：${missingNames}。对应任务将由其他成员代为处理。`;
      }
    } else {
      const continuationContext = buildContinuationContext(conversationHistory, aiParticipants);

      const routeResult = resolveRoute({
        message: lastUserMessage,
        participants: aiParticipantObjects,
        ctx: { focusEmployeeId: null, focusReason: null, focusSetAt: 0, lastInteractionMap: {} },
        activeStepEmployeeId: null,
        continuationContext,
      });

      if (routeResult.type === "continuation") {
        targetSlugs = [routeResult.employeeId];
        continuationUpstreamOutput = routeResult.upstreamOutput;
      } else {
        targetSlugs = routeResult.type === "broadcast"
          ? aiParticipants
          : routeResult.type === "direct"
          ? [routeResult.employeeId]
          : aiParticipants.length > 0
          ? [aiParticipants[0]]
          : [];
      }
    }
  }

  if (resumeStep > 0 && targetSlugs.length > resumeStep) {
    targetSlugs = targetSlugs.slice(resumeStep);
  }

  const agentMap = await assembleGroupContext(targetSlugs, {
    userId: userId ?? undefined,
    orgId: organizationId,
  });

  const EMPLOYEE_ROLE_LABELS: Record<string, { name: string; task: string }> = {
    xiaolei: { name: "热点分析师（小雷）", task: "信息检索与资料收集" },
    xiaoce: { name: "选题策划师（小策）", task: "选题策划与角度分析" },
    xiaozi: { name: "素材研究员（小资）", task: "素材整理与知识管理" },
    xiaowen: { name: "内容创作师（小文）", task: "内容撰写与文案创作" },
    xiaojian: { name: "视频制片人（小剪）", task: "视频制作与剪辑方案" },
    xiaoshen: { name: "质量审核官（小审）", task: "质量检测与内容审核" },
    xiaofa: { name: "渠道运营师（小发）", task: "渠道分发与运营策略" },
    xiaoshu: { name: "数据分析师（小数）", task: "数据分析与效果追踪" },
  };

  const isMultiStep = targetSlugs.length > 1;

  const approvePattern = /^(确认|ok|okay|好的|可以|没问题|继续|通过|approve|✅|pass|下一步|next|确认继续|就这样|行了|完成|对|是|yes|y)$/i;

  const stepExecutor: StepExecutor = async function* (step) {
    const agent = agentMap.get(step.employeeSlug);
    if (!agent) {
      yield { textDelta: `[${step.employeeSlug} 不可用]`, done: true, output: "" };
      return;
    }

    const roleInfo = EMPLOYEE_ROLE_LABELS[step.employeeSlug];
    const intentStep = intentStepsFromMeta?.find((s) => s.employeeSlug === step.employeeSlug);
    let userPrompt = step.prompt;
    const upstreamOutput = step.priorOutput || opts.priorStepOutput || continuationUpstreamOutput || "";

    const RETRIEVAL_SLUGS = new Set([
      "web_search", "web_deep_read", "trending_topics", "trend_monitor",
      "social_listening", "news_aggregation", "heat_scoring",
      "media_search", "knowledge_retrieval", "fact_check",
      "competitor_analysis", "sentiment_analysis",
    ]);
    const GENERATION_SLUGS = new Set([
      "content_generate", "headline_generate", "summary_generate",
      "script_generate", "style_rewrite", "translation",
    ]);
    const stepSkills = intentStep?.skills ?? [];
    const hasRetrievalIntent = stepSkills.some((s) => RETRIEVAL_SLUGS.has(s));
    const hasGenerationIntent = stepSkills.some((s) => GENERATION_SLUGS.has(s));

    let preExecBlock = "";
    if (hasRetrievalIntent && !upstreamOutput) {
      const searchQuery = extractSearchQuery(lastUserMessage);
      const resolvedTimeRange = resolveWebSearchTimeRange(lastUserMessage);
      const params: Record<string, unknown> = {
        query: searchQuery,
        maxResults: 8,
        topic: "news",
      };
      if (resolvedTimeRange) {
        params.timeRange = resolvedTimeRange;
      }

      yield { thinking: { tool: "web_search", label: "正在搜索互联网资料" }, done: false, output: "" };

      const invocation = await invokeToolDirectly("web_search", params, {
        organizationId,
        operatorId: userId ?? undefined,
      });

      if (invocation.ok) {
        const serialized = JSON.stringify(invocation.result, null, 2);
        const truncated = serialized.length > 8000
          ? serialized.slice(0, 8000) + "\n... (结果过长已截断)"
          : serialized;
        const resultObj = invocation.result as { results?: unknown[] } | null;
        const list = resultObj && typeof resultObj === "object"
          ? (Array.isArray(resultObj.results) ? resultObj.results : null)
          : null;
        let hint = "";
        if (list) {
          if (list.length === 0) {
            hint = `\n\n⚠️ 真实结果为空（0 条）。你必须如实告知用户"未检索到最新结果"，**严禁从训练数据里补填任何文章、日期、数据、引用**。`;
          } else if (list.length <= 2) {
            hint = `\n\n⚠️ 真实结果仅 ${list.length} 条。只在这些条内做处理；**不得**从训练数据里补充其他条目。`;
          }
        }
        preExecBlock = `【前置工具调用结果（server 端已执行，这是真实数据）】\n调用：\`web_search(${JSON.stringify(invocation.params)}\`\n\n结果：\n\`\`\`json\n${truncated}\n\`\`\`${hint}`;

        if (hasRetrievalIntent && !hasGenerationIntent) {
          const resultsList = Array.isArray(list) ? list : [];
          const todayIso = new Date().toISOString().slice(0, 10);
          const result = invocation.result as {
            query?: string; generatedAt?: string; summary?: string;
            coverage?: { returnedCount?: number; sourceCount?: number };
            results?: Array<{ title?: string; snippet?: string; url?: string; source?: string; publishedAt?: string }>;
          };
          const formatted = (result.results ?? []).slice(0, 8).map((r, idx) => {
            const date = r.publishedAt ? new Date(r.publishedAt).toISOString().slice(0, 10) : "日期未知";
            return `${idx + 1}. **${r.title ?? "(无标题)"}**\n   · ${r.source ?? "未知来源"} · ${date}\n   · ${r.snippet ?? ""}\n   · ${r.url ?? ""}`;
          }).join("\n\n");

          if (resultsList.length === 0) {
            const emptyText = `【${roleInfo?.name ?? step.employeeSlug} · 实时检索报告】\n\n**检索参数**：query="${searchQuery}"，timeRange=${resolvedTimeRange ?? "unset"}\n**生成时间**：${todayIso}\n**命中条数**：0 条\n\n## 未检索到符合条件的真实报道\n\n不伪造结果。请调整关键词或时间范围后重试。\n\n---\n*本步骤由 server 端直接执行，未经 LLM 改写。*`;
            yield { textDelta: emptyText, done: false, output: "" };
            yield { done: true, output: emptyText };
            return;
          }

          const shortCircuitText = `【${roleInfo?.name ?? step.employeeSlug} · 实时检索报告】\n\n**检索参数**：query="${searchQuery}"，timeRange=${resolvedTimeRange ?? "unset"}\n**生成时间**：${todayIso}\n**命中条数**：${result.coverage?.returnedCount ?? resultsList.length} 条（来源 ${result.coverage?.sourceCount ?? 0} 个）\n\n${result.summary ? `**检索摘要**：${result.summary}\n\n` : ""}## 最新报道（按相关度排序）\n\n${formatted}\n\n---\n*本步骤由 server 端直接从 Tavily 实时返回，未经 LLM 改写，保证来源、标题、日期、URL 100% 原样。*`;
          yield { textDelta: shortCircuitText, done: false, output: "" };
          yield { done: true, output: shortCircuitText };
          return;
        }
      }
    }

    if (roleInfo && (isMultiStep || upstreamOutput || preExecBlock)) {
      const parts: string[] = [
        `【协作任务说明】`,
        `你是${roleInfo.name}，在本次协作任务中，你负责的是：**${intentStep?.taskDescription ?? roleInfo.task}**`,
        ``,
        `原始需求：${step.prompt}`,
        ``,
      ];
      if (missingWarning) {
        parts.push(missingWarning);
        parts.push(``);
      }
      parts.push(`请只完成你负责的"${intentStep?.taskDescription ?? roleInfo.task}"部分，不要做其他人的工作。直接开始执行并输出结果，不要先描述执行计划。`);
      if (preExecBlock) {
        parts.push(``);
        parts.push(preExecBlock);
        const today = new Date().toISOString().slice(0, 10);
        parts.push(``);
        parts.push(`【基于真实数据的硬约束】\n- 今天是 **${today}**\n- 只能使用前置工具调用结果中列出的真实条目；**禁止**引入这些结果里没有出现过的任何标题、来源、日期、数据、URL\n- 真实结果为空时：如实说明"未检索到相关内容"，**禁止虚构**`);
      }
      if (upstreamOutput) {
        parts.push(``);
        parts.push(`【上一步的产出】`);
        parts.push(upstreamOutput);
        parts.push(``);
        parts.push(`请基于上一步的产出，继续完成你的工作。`);
      }
      const feedbackMsg = lastUserMessage !== step.prompt ? lastUserMessage : "";
      if (feedbackMsg && !approvePattern.test(feedbackMsg)) {
        parts.push(``);
        parts.push(`【用户修改意见】`);
        parts.push(feedbackMsg);
        parts.push(`请根据修改意见调整你的工作。`);
      }
      userPrompt = parts.join("\n");
    }

    const model = getLanguageModel(agent.modelConfig);
    const vercelTools = toVercelTools(agent.tools, agent.pluginConfigs);

    const result = streamText({
      model,
      system: agent.systemPrompt,
      messages: [
        { role: "user" as const, content: userPrompt },
      ],
      tools: vercelTools,
      stopWhen: stepCountIs(10),
      maxOutputTokens: 8192,
      temperature: 0.5,
    });

    let output = "";
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        output += part.text;
        yield { textDelta: part.text, done: false, output: "" };
      }
      if (part.type === "tool-call") {
        const label = TOOL_LABELS[part.toolName] ?? `正在执行${part.toolName}`;
        yield { thinking: { tool: part.toolName, label }, done: false, output: "" };
      }
    }

    yield { done: true, output };
  };

  const plan = planFromTemplate({
    participantIds: targetSlugs,
    mode: effectiveGroupMode,
    triggerMessage: {
      content: (resumeStep > 0 || hasPriorOutput)
        ? opts.conversationHistory.find((m) => m.role === "user")?.content || lastUserMessage
        : lastUserMessage,
      senderId: userId ?? "user",
    },
    conversationId,
    participants: aiParticipants.map((slug) => ({
      participantId: slug,
      participantType: "ai_employee" as const,
      role: "member" as const,
    })),
  });

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch { /* intentional: stream already closed */ }
      };

      try {
        const gen = effectiveGroupMode === "parallel"
          ? executeParallelPlan(plan, stepExecutor)
          : executeSerialPlan(plan, stepExecutor);

        let chainCurrent = 0;
        const chainTotal = targetSlugs.length;
        const participantOutputMap = new Map<string, string>();

        for await (const event of gen) {
          switch (event.type) {
            case "participant_start":
              send("participant-start", {
                participantId: event.participantId,
                participantName: EMPLOYEE_ROLE_LABELS[event.participantId]?.name || event.participantName,
              });
              break;
            case "participant_end":
              send("participant-end", {
                participantId: event.participantId,
                summary: event.summary,
              });
              if (effectiveGroupMode === "serial" && isMultiStep && chainCurrent < chainTotal) {
                const nextIdx = chainCurrent;
                const nextSlug = targetSlugs[nextIdx];
                const nextRole = EMPLOYEE_ROLE_LABELS[nextSlug];
                const currentRole = EMPLOYEE_ROLE_LABELS[event.participantId];
                send("step-review", {
                  stepIndex: chainCurrent - 1,
                  totalSteps: chainTotal,
                  employeeSlug: event.participantId,
                  employeeName: currentRole?.name || event.participantId,
                  taskTitle: `${currentRole?.name || event.participantId} 完成了${currentRole?.task || "任务"}`,
                  outputPreview: participantOutputMap.get(event.participantId)?.slice(0, 500) ?? "",
                  priorStepOutput: participantOutputMap.get(event.participantId) ?? "",
                  nextStepDescription: nextRole ? nextRole.task : nextSlug,
                  nextStepEmployee: nextRole ? nextRole.name : nextSlug,
                  isLastStep: false,
                  originalTargetSlugs: targetSlugs,
                });
                send("done", {});
                controller.close();
                return;
              }
              break;
            case "chain_progress":
              chainCurrent = event.current;
              send("chain-progress", {
                current: event.current,
                total: event.total,
              });
              break;
            case "text-delta":
              if (event.senderId) {
                const prev = participantOutputMap.get(event.senderId) ?? "";
                participantOutputMap.set(event.senderId, prev + event.content);
              }
              send("text-delta", {
                text: event.content,
                senderId: event.senderId,
                senderName: EMPLOYEE_ROLE_LABELS[event.senderId]?.name || event.senderId,
              });
              break;
            case "thinking":
              send("thinking", {
                tool: event.tool,
                label: event.label,
                senderId: event.senderId,
              });
              break;
            case "parallel_merge":
              send("parallel-merge", {
                leaderSlug: event.leaderSlug,
                summaries: event.summaries,
              });
              break;
            case "arbitration_start":
              send("arbitration-start", {
                conflictDescription: event.conflictDescription,
                participants: event.participants,
                maxRounds: event.maxRounds,
              });
              break;
            case "arbitration_end":
              send("arbitration-end", {
                conclusion: event.conclusion,
                resolution: event.resolution,
              });
              break;
            case "done":
              send("done", {});
              break;
            case "error":
              send("error", { message: event.message });
              break;
          }
        }
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "未知错误",
        });
      } finally {
        try { controller.close(); } catch { /* intentional: stream already closed */ }
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
}
