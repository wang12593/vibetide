import { generateText } from "ai";
import { getLanguageModel } from "./model-router";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";

export type {
  ChatIntentType,
  IntentStep,
  IntentResult,
} from "./types";
export { INTENT_TYPE_LABELS } from "./types";

import { INTENT_TYPE_LABELS, type ChatIntentType, type ClarificationQuestion, type IntentResult } from "./types";

export interface IntentMemoryEntry {
  userMessage: string;
  intentType: string;
  skills: string[];
  userEdited: boolean;
}

interface EmployeeSkillInfo {
  slug: string;
  name: string;
  nickname: string;
  title: string;
  skills: string[];
}

export interface ScenarioInfo {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  defaultTeam?: string[];
}

function buildEmployeeCatalog(
  availableEmployees: EmployeeSkillInfo[]
): string {
  return availableEmployees
    .filter((e) => e.slug !== "leader")
    .map(
      (e) =>
        `- ${e.slug}（${e.nickname}，${e.title}）：擅长 ${e.skills.join("、")}`
    )
    .join("\n");
}

function buildScenarioCatalog(scenarios: ScenarioInfo[]): string {
  if (scenarios.length === 0) return "- 暂无可用场景";
  return scenarios
    .slice(0, 30)
    .map((s) => {
      const team = s.defaultTeam?.length ? `，默认团队：${s.defaultTeam.join("、")}` : "";
      return `- ${s.id}（${s.name}）：${s.description || "无描述"}${team}`;
    })
    .join("\n");
}

function buildFewShotExamples(memories: IntentMemoryEntry[]): string {
  if (memories.length === 0) return "";

  const examples = memories
    .slice(0, 10)
    .map(
      (m, i) =>
        `${i + 1}. 用户："${m.userMessage}" → 意图：${m.intentType}${m.userEdited ? "（用户修正过）" : ""}`
    )
    .join("\n");

  return `\n## 该用户的历史意图模式（参考，但不要生搬硬套）\n${examples}\n`;
}

const INTENT_PROMPT = `意图识别引擎（员工优先，其次场景）。分析用户输入，确定最合适的穆兰路由目标。

## 核心原则（最重要！）
1. **优先匹配员工**：先确定"谁来做"，不要把技能作为路由目标
2. **其次匹配场景**：当用户明确提到可复用流程、模板、场景名称，或任务更适合作为预设流程时，返回 workflowId/workflowName
3. **简单任务派一人**：搜索→小乐，写文章→小文，分析→小策，数据→小数，审核→小鉴，发布→小发
4. **复杂任务派多人或 Mission**：涉及多个环节的任务（如"策划并制作短视频"）需要多个员工协作
5. **穆兰不执行技能**：leader（穆兰）是调度者，不要在 steps 中使用 leader 作为执行者

## 数字员工
{EMPLOYEE_CATALOG}

## 可用场景
{SCENARIO_CATALOG}
{FEW_SHOT}
## 意图类型
information_retrieval / content_creation / deep_analysis / data_analysis / content_review / media_production / publishing / general_chat

## 规则
- 按依赖关系排列步骤，dependsOn 从 0 开始（第 1 步为 null）
- 闲聊/问候返回 general_chat 且 steps=[]
- confidence: 明确>0.8, 较明确0.6-0.8, 模糊<0.6
- ⚠️ **严禁编造不存在的数字员工**：steps 中的 employeeSlug 必须来自上面的员工列表
- steps 中 skills 必须返回 []，技能由员工或场景内部自行选择，穆兰 UI 不展示技能路由
- 当命中场景时，设置 workflowId、workflowName、executionMode="workflow"

## 意图分类指南
- information_retrieval：搜索、查找、获取信息。关键词：搜索、查、找、搜、看看、有什么
- deep_analysis：分析、研究、解读、对比已有内容。关键词：分析、研究、解读、对比、盘点、拆解、洞察
- data_analysis：数据统计、趋势分析、报表生成。关键词：数据、统计、趋势、报表、指标
- content_creation：写、创作、生成新内容。关键词：写、创作、生成、撰写、起草、编
- media_production：制作视频/音频/图片等媒体产物。关键词：剪辑、制作、拍、录、配音、分镜
- content_review：审核、检查、评估已有内容。关键词：审核、检查、评估、审校、质检
- publishing：发布、分发、运营。关键词：发布、分发、推送、运营、推广

### ⚠️ 常见误判警示
- "爆款作品分析" "央媒内容分析" → deep_analysis，**不是** content_creation
- "短视频趋势分析" → deep_analysis 或 data_analysis，**不是** media_production
- "XX平台热点分析" → information_retrieval + deep_analysis
- "分析"出现在用户输入中 → 绝大多数应归类为 deep_analysis

## 信息补全规则
当用户意图涉及「爆款分析」「央媒分析」「作品分析」「账号分析」「内容分析」「平台分析」等需要指定平台和作品类型的任务时：
- 如果用户没有明确指定「平台」或「作品类型」，设置 needsClarification=true 并提问
- 可搜索平台：微博、今日头条、B站、小红书、知乎、百家号
- 不可搜索平台（不要推荐）：抖音、快手、微信视频号、西瓜视频
- 作品类型：短视频、长视频、图文、直播回放、音频/播客、互动H5、合集/系列、专题报道

输出JSON（不含markdown）：
{
  "intentType": "...",
  "summary": "一句话方案",
  "confidence": 0-1,
  "steps": [{"employeeSlug":"", "employeeName":"", "skills":[], "taskDescription":"", "dependsOn": null}],
  "reasoning": "简短推理（1-2句）",
  "workflowId": null,
  "workflowName": null,
  "executionMode": "auto",
  "needsClarification": false,
  "clarificationQuestions": []
}

当 needsClarification 为 true 时，clarificationQuestions 数组中每个元素格式：
{"id": "唯一标识", "field": "字段名", "question": "提问文本", "options": [{"label": "显示名", "value": "值"}], "allowCustom": false, "placeholder": "自定义输入提示"}

### 📌 多轮追问模式（重要）
当 <clarification_history> 存在时，你处于多轮追问模式：
1. 基于已有历史判断信息是否足够
2. 如果信息仍不足，只生成 1 个 clarificationQuestion（最重要的缺失信息）
3. 不要重复 <clarification_history> 中已问过的问题
4. 如果 history 累积后已足够（confidence >= 0.9 或关键信息齐全），设置 needsClarification=false
5. 多轮模式每轮只返回 1 个问题，不要返回多个`;

const GREETING_PATTERNS = /^(你好|您好|hi|hello|hey|在吗|在么|早|晚安|嗨|哈喽|哈罗|在不在|嘿|啊|嗯|好的|收到|谢谢|thanks|thank you|ok|okay)[\s!！。.?？~～]*$/i;
const SHORT_CHAT_THRESHOLD = 6;

function checkNeedsClarification(message: string, intentType: ChatIntentType): boolean {
  const DETAILED_LENGTH = 15;
  const hasSpecificContent = message.length >= DETAILED_LENGTH;
  const hasTopicKeywords = /关于|主题|话题|针对|围绕|分析|研究|比较|对比|趋势/.test(message);
  if (hasSpecificContent || hasTopicKeywords) return false;
  const NEEDS_DETAIL_INTENTS: ChatIntentType[] = [
    "content_creation", "deep_analysis", "data_analysis",
    "media_production", "information_retrieval",
  ];
  return NEEDS_DETAIL_INTENTS.includes(intentType);
}

function buildClarificationForIntent(intentType: ChatIntentType): ClarificationQuestion[] {
  const questions: Record<string, ClarificationQuestion[]> = {
    content_creation: [
      { id: "topic", field: "topic", question: "请问您希望写什么主题的内容？", options: [], allowCustom: true, placeholder: "例如：人工智能在教育领域的应用" },
      { id: "style", field: "style", question: "您希望什么风格？", options: [{ label: "专业严谨", value: "professional" }, { label: "轻松活泼", value: "casual" }, { label: "深度分析", value: "analytical" }], allowCustom: true, placeholder: "其他风格" },
    ],
    deep_analysis: [
      { id: "subject", field: "subject", question: "请问您想分析什么主题？", options: [], allowCustom: true, placeholder: "例如：新能源汽车市场趋势" },
      { id: "depth", field: "depth", question: "分析深度？", options: [{ label: "概览", value: "overview" }, { label: "深度", value: "deep" }], allowCustom: false, placeholder: "" },
    ],
    data_analysis: [
      { id: "scope", field: "scope", question: "请问需要分析哪方面的数据？", options: [], allowCustom: true, placeholder: "例如：抖音近30天互动数据" },
      { id: "metrics", field: "metrics", question: "关注哪些指标？", options: [{ label: "互动量", value: "engagement" }, { label: "转发量", value: "shares" }, { label: "播放量", value: "views" }], allowCustom: true, placeholder: "其他指标" },
    ],
    information_retrieval: [
      { id: "query", field: "query", question: "请问您想搜索什么信息？", options: [], allowCustom: true, placeholder: "例如：2024年AI行业最新动态" },
    ],
    media_production: [
      { id: "content", field: "content", question: "请问您想制作什么内容？", options: [], allowCustom: true, placeholder: "例如：AI产品介绍短视频" },
    ],
  };
  return questions[intentType] || [];
}

const INTENT_TO_EMPLOYEE: Record<string, { slug: string }> = {
  information_retrieval: { slug: "xiaolei" },
  content_creation: { slug: "xiaowen" },
  deep_analysis: { slug: "xiaoce" },
  data_analysis: { slug: "xiaoshu" },
  content_review: { slug: "xiaoshen" },
  media_production: { slug: "xiaojian" },
  publishing: { slug: "xiaofa" },
};

const LEVEL0_RULES: Array<{
  pattern: RegExp;
  intentType: ChatIntentType;
  confidence: number;
}> = [
  { pattern: /^(搜索|搜一下|查一下|帮我查|搜搜|有什么|看看).*/i, intentType: "information_retrieval", confidence: 0.88 },
  { pattern: /^(搜索|查|找|搜).*(新闻|热点|话题|资讯|信息|资料)/i, intentType: "information_retrieval", confidence: 0.9 },
  { pattern: /(热点|热搜|热门|最新).*(新闻|话题|资讯)/i, intentType: "information_retrieval", confidence: 0.88 },
  { pattern: /^(写一篇|写个|帮我写|生成).*(文章|稿|报道|文案|新闻|内容)/i, intentType: "content_creation", confidence: 0.9 },
  { pattern: /^(写|创作|生成|撰写|起草).*(文|稿|章)/i, intentType: "content_creation", confidence: 0.85 },
  { pattern: /^(分析|解读|对比|盘点|拆解|洞察).*(数据|报告|趋势|内容|文章)/i, intentType: "deep_analysis", confidence: 0.88 },
  { pattern: /^(分析|解读|研究).*/i, intentType: "deep_analysis", confidence: 0.82 },
  { pattern: /(数据|统计|趋势|报表|指标|图表).*(分析|报告|统计)/i, intentType: "data_analysis", confidence: 0.88 },
  { pattern: /^(审核|检查|评估|审校|质检).*/i, intentType: "content_review", confidence: 0.88 },
  { pattern: /^(制作|剪辑|拍|录|配音|分镜).*(视频|音频|图片|短片)/i, intentType: "media_production", confidence: 0.88 },
  { pattern: /^(发布|分发|推送|运营|推广).*/i, intentType: "publishing", confidence: 0.85 },
];

const COMPLEX_TASK_RULES: Array<{
  pattern: RegExp;
  employees: string[];
  intentType: ChatIntentType;
  summary: string;
}> = [
  {
    pattern: /(短视频|视频栏目).*(策划|制作|方案|全流程)/i,
    employees: ["xiaoce", "xiaowen", "xiaojian"],
    intentType: "media_production",
    summary: "短视频制作全流程",
  },
  {
    pattern: /(深度报道|专题报道|系列报道).*(策划|制作)/i,
    employees: ["xiaoce", "xiaolei", "xiaowen", "xiaoshen"],
    intentType: "content_creation",
    summary: "深度报道制作",
  },
  {
    pattern: /(全平台|多平台).*(发布|分发|运营)/i,
    employees: ["xiaofa", "xiaoshu"],
    intentType: "publishing",
    summary: "多平台发布运营",
  },
  {
    pattern: /(热点|选题).*(策划|选题会|报道方案)/i,
    employees: ["xiaolei", "xiaoce"],
    intentType: "deep_analysis",
    summary: "热点选题策划",
  },
  {
    pattern: /(内容|稿件).*(审核|质检|把关).*(发布|上线)/i,
    employees: ["xiaoshen", "xiaofa"],
    intentType: "content_review",
    summary: "内容审核与发布",
  },
  {
    pattern: /(新媒体|全渠道).*(运营|矩阵)/i,
    employees: ["xiaofa", "xiaoshu", "xiaowen"],
    intentType: "publishing",
    summary: "新媒体矩阵运营",
  },
];

interface Level0Result {
  intentType: ChatIntentType;
  confidence: number;
  matched: boolean;
}

function ruleBasedClassify(message: string): Level0Result {
  const trimmed = message.trim();
  for (const rule of LEVEL0_RULES) {
    if (rule.pattern.test(trimmed)) {
      return { intentType: rule.intentType, confidence: rule.confidence, matched: true };
    }
  }
  return { intentType: "general_chat" as ChatIntentType, confidence: 0, matched: false };
}

function complexTaskMatch(message: string) {
  const trimmed = message.trim();
  for (const rule of COMPLEX_TASK_RULES) {
    if (rule.pattern.test(trimmed)) {
      return rule;
    }
  }
  return null;
}

function scenarioMatch(message: string, scenarios: ScenarioInfo[]) {
  const trimmed = message.trim();
  if (!trimmed || scenarios.length === 0) return null;
  const wantsScenario = /场景|模板|流程|套路|方案|预设/.test(trimmed);
  const normalized = trimmed.toLowerCase();
  return scenarios.find((scenario) => {
    const name = scenario.name.toLowerCase();
    if (name && normalized.includes(name)) return true;
    if (!wantsScenario) return false;
    return !!scenario.description && normalized.includes(scenario.description.toLowerCase().slice(0, 12));
  }) ?? null;
}

function isGreeting(message: string): boolean {
  const trimmed = message.trim();
  if (trimmed.length <= SHORT_CHAT_THRESHOLD && GREETING_PATTERNS.test(trimmed)) {
    return true;
  }
  return false;
}

function withRouteTarget(result: IntentResult): IntentResult {
  if (result.routeTarget) return result;
  if (result.intentType === "general_chat" && result.steps.length === 0) {
    return {
      ...result,
      routeTarget: { kind: "llm", reason: result.reasoning || result.summary },
    };
  }
  if (result.workflowId) {
    return {
      ...result,
      routeTarget: {
        kind: "scenario",
        scenarioId: result.workflowId,
        scenarioName: result.workflowName,
        reason: result.reasoning || result.summary,
        confidence: result.confidence,
      },
    };
  }
  if (result.steps.length > 1) {
    return {
      ...result,
      routeTarget: {
        kind: "mission",
        title: result.summary,
        employeeSlugs: result.steps.map((s) => s.employeeSlug),
        reason: result.reasoning || result.summary,
        confidence: result.confidence,
      },
    };
  }
  if (result.steps.length === 1) {
    return {
      ...result,
      routeTarget: {
        kind: "employee",
        employeeSlug: result.steps[0].employeeSlug,
        reason: result.reasoning || result.summary,
        confidence: result.confidence,
      },
    };
  }
  return result;
}

export async function recognizeIntent(
  message: string,
  currentEmployeeSlug: string,
  availableEmployees: EmployeeSkillInfo[],
  userMemories: IntentMemoryEntry[] = [],
  clarifiedParameters?: Record<string, string>,
  clarificationHistory?: Array<{ question: string; answer: string }>,
  availableScenarios: ScenarioInfo[] = [],
): Promise<IntentResult> {
  if (isGreeting(message)) {
    return withRouteTarget({
      intentType: "general_chat",
      summary: "日常对话",
      confidence: 0.95,
      steps: [],
      reasoning: "检测到问候语，直接进入自由对话",
    });
  }

  const complexMatch = complexTaskMatch(message);
  if (complexMatch) {
    const rawSteps = complexMatch.employees
      .map((slug) => {
        const emp = availableEmployees.find((e) => e.slug === slug);
        if (!emp) return null;
        return {
          employeeSlug: emp.slug as EmployeeId,
          employeeName: emp.nickname,
          skills: [],
          taskDescription: message,
        };
      })
      .filter(Boolean) as Array<{
        employeeSlug: EmployeeId;
        employeeName: string;
        skills: string[];
        taskDescription: string;
      }>;

    const steps = rawSteps.map((step, i) => ({
      ...step,
      dependsOn: i === 0 ? undefined : i - 1,
    }));

    return withRouteTarget({
      intentType: complexMatch.intentType,
      summary: complexMatch.summary,
      confidence: 0.9,
      steps,
      reasoning: `复杂任务规则匹配，调度 ${complexMatch.employees.length} 个员工协作`,
    });
  }

  const ruleResult = ruleBasedClassify(message);
  if (ruleResult.matched) {
    const MULTI_ROLE_KEYWORDS = /检索|搜索|搜集|调研|审核|质检|检查|校对|审查|发布|分发|排版|配图|制作|视频|数据分析|统计/;
    if (MULTI_ROLE_KEYWORDS.test(message)) {
      // Message mentions multi-role tasks — let LLM decide
    } else {
      const mapping = INTENT_TO_EMPLOYEE[ruleResult.intentType];
      const targetSlug = mapping?.slug || currentEmployeeSlug;
      const emp = availableEmployees.find((e) => e.slug === targetSlug);
      const matchedEmp = emp || availableEmployees.find((e) => e.slug === currentEmployeeSlug);

      if (matchedEmp && ruleResult.confidence >= 0.85) {
        const needsDetail = checkNeedsClarification(message, ruleResult.intentType);
        if (needsDetail) {
          return withRouteTarget({
            intentType: ruleResult.intentType,
            summary: `${matchedEmp.nickname}将为您${INTENT_TYPE_LABELS[ruleResult.intentType] || ruleResult.intentType}`,
            confidence: ruleResult.confidence * 0.9,
            steps: [{
              employeeSlug: matchedEmp.slug as EmployeeId,
              employeeName: matchedEmp.nickname,
              skills: [],
              taskDescription: message,
            }],
            reasoning: `Level 0 规则命中但需求细节不足，需要追问`,
            needsClarification: true,
            clarificationQuestions: buildClarificationForIntent(ruleResult.intentType),
          });
        }
      return withRouteTarget({
        intentType: ruleResult.intentType,
        summary: `${matchedEmp.nickname}将为您${INTENT_TYPE_LABELS[ruleResult.intentType] || ruleResult.intentType}`,
        confidence: ruleResult.confidence,
        steps: [{
          employeeSlug: matchedEmp.slug as EmployeeId,
          employeeName: matchedEmp.nickname,
          skills: [],
          taskDescription: message,
        }],
        reasoning: `Level 0 规则引擎命中，直接分派 ${matchedEmp.nickname}`,
      });
    }
    }
  }

  const matchedScenario = scenarioMatch(message, availableScenarios);
  if (matchedScenario) {
    const steps = (matchedScenario.defaultTeam ?? [])
      .map((slug, i) => {
        const emp = availableEmployees.find((e) => e.slug === slug);
        if (!emp || emp.slug === "leader") return null;
        return {
          employeeSlug: emp.slug as EmployeeId,
          employeeName: emp.nickname,
          skills: [],
          taskDescription: message,
          dependsOn: i === 0 ? undefined : i - 1,
        };
      })
      .filter(Boolean) as IntentResult["steps"];

    return withRouteTarget({
      intentType: "deep_analysis",
      summary: `推荐场景「${matchedScenario.name}」`,
      confidence: 0.86,
      steps,
      reasoning: `未命中更明确的单员工路由，匹配到可复用场景「${matchedScenario.name}」`,
      workflowId: matchedScenario.id,
      workflowName: matchedScenario.name,
      executionMode: "workflow",
    });
  }

  const employeeCatalog = buildEmployeeCatalog(availableEmployees);
  const scenarioCatalog = buildScenarioCatalog(availableScenarios);
  const fewShot = buildFewShotExamples(userMemories.slice(0, 5));

  const systemPrompt = INTENT_PROMPT
    .replace("{EMPLOYEE_CATALOG}", employeeCatalog)
    .replace("{SCENARIO_CATALOG}", scenarioCatalog)
    .replace("{FEW_SHOT}", fewShot);

  const parameterBlock = clarifiedParameters && Object.keys(clarifiedParameters).length > 0
    ? `\n\n<collected_parameters>\n${JSON.stringify(clarifiedParameters)}\n</collected_parameters>\n以上是用户已确认的参数，请在生成 steps 的 taskDescription 中包含这些参数。`
    : "";

  const historyBlock = clarificationHistory && clarificationHistory.length > 0
    ? `\n\n<clarification_history>\n${JSON.stringify(clarificationHistory)}\n</clarification_history>\n以上是多轮追问的历史记录，请基于已有信息判断是否还需要追问，如需追问只返回 1 个问题。`
    : "";

  const userPrompt = `当前选中的数字员工：${currentEmployeeSlug}\n用户输入：${message}${parameterBlock}${historyBlock}`;

  try {
    const INTENT_TIMEOUT_MS = 15000;
    const generatePromise = generateText({
      model: getLanguageModel({
        provider: "openai",
        model: process.env.OPENAI_MODEL || "Qwen3.5-35B-A3B",
        temperature: 0,
        maxTokens: 1024,
      }),
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0,
      maxOutputTokens: 1024,
    });

    const result = await Promise.race([
      generatePromise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("意图识别超时（15秒）")),
          INTENT_TIMEOUT_MS
        )
      ),
    ]);

    let text = result.text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(text) as IntentResult;

    parsed.confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0.5));

    const validTypes: ChatIntentType[] = [
      "information_retrieval",
      "content_creation",
      "deep_analysis",
      "data_analysis",
      "content_review",
      "media_production",
      "publishing",
      "general_chat",
    ];
    if (!validTypes.includes(parsed.intentType)) {
      parsed.intentType = "general_chat";
      parsed.confidence = 0.5;
    }

    const validSlugs = new Set(availableEmployees.map((e) => e.slug));
    parsed.steps = parsed.steps.filter((s) => validSlugs.has(s.employeeSlug) && s.employeeSlug !== "leader");

    if (parsed.steps.length === 0 && parsed.intentType !== "general_chat") {
      const mapping = INTENT_TO_EMPLOYEE[parsed.intentType];
      const fallbackSlug = mapping?.slug || currentEmployeeSlug;
      const current = availableEmployees.find((e) => e.slug === fallbackSlug);
      if (current) {
        parsed.steps = [
          {
            employeeSlug: current.slug as EmployeeId,
            employeeName: current.nickname,
            skills: [],
            taskDescription: message,
          },
        ];
        parsed.confidence = Math.min(parsed.confidence, 0.6);
      }
    }

    for (const step of parsed.steps) {
      step.skills = [];
    }

    if (parsed.workflowId) {
      const scenario = availableScenarios.find((s) => s.id === parsed.workflowId);
      parsed.workflowName = parsed.workflowName || scenario?.name;
      parsed.executionMode = "workflow";
    } else {
      parsed.executionMode = "auto";
    }

    if (parsed.needsClarification) {
      if (!Array.isArray(parsed.clarificationQuestions) || parsed.clarificationQuestions.length === 0) {
        parsed.needsClarification = false;
        delete parsed.clarificationQuestions;
      } else {
        parsed.clarificationQuestions = parsed.clarificationQuestions.filter(
          (q): q is ClarificationQuestion => !!(q && typeof q.id === "string" && typeof q.question === "string" && q.question.length > 0)
        );
        if (parsed.clarificationQuestions.length === 0) {
          parsed.needsClarification = false;
          delete parsed.clarificationQuestions;
        }
      }
    }

    // Persist clarificationHistory for frontend to track multi-turn state
    if (clarificationHistory && clarificationHistory.length > 0) {
      parsed.clarificationHistory = clarificationHistory;
    }

    return withRouteTarget(parsed);
  } catch (err) {
    console.error("[intent-recognition] Failed:", err);
    return withRouteTarget({
      intentType: "general_chat",
      summary: "自由对话",
      confidence: 0.5,
      steps: [],
      reasoning: `意图识别失败，回退到自由对话模式。(${err instanceof Error ? err.message : "unknown"})`,
    });
  }
}
