type EmployeeSlug = string;

export type ChatContext = {
  focusEmployeeId: EmployeeSlug | null;
  focusReason: "active_step" | "recent_interaction" | null;
  focusSetAt: number;
  lastInteractionMap: Record<EmployeeSlug, number>;
};

export type RouteResult =
  | { type: "direct"; employeeId: EmployeeSlug }
  | { type: "broadcast" }
  | { type: "continuation"; employeeId: EmployeeSlug; upstreamOutput?: string }
  | { type: "fallback"; employeeId: EmployeeSlug };

const INTENT_KEYWORD_MAP: Record<string, EmployeeSlug> = {
  "检索": "xiaolei",
  "搜索": "xiaolei",
  "搜": "xiaolei",
  热: "xiaolei",
  热点: "xiaolei",
  监控: "xiaolei",
  策划: "xiaoce",
  选题: "xiaoce",
  素材: "xiaozi",
  采集: "xiaozi",
  写: "xiaowen",
  撰写: "xiaowen",
  写稿: "xiaowen",
  写作: "xiaowen",
  创作: "xiaowen",
  文章: "xiaowen",
  审: "xiaoshen",
  审核: "xiaoshen",
  审稿: "xiaoshen",
  检查: "xiaoshen",
  检测: "xiaoshen",
  质量: "xiaoshen",
  把关: "xiaoshen",
  发: "xiaofa",
  分发: "xiaofa",
  发布: "xiaofa",
  推送: "xiaofa",
  数据: "xiaoshu",
  分析: "xiaoshu",
  统计: "xiaoshu",
  知识: "xiaoshu",
  查: "xiaoshu",
  视频: "xiaojian",
  剪辑: "xiaojian",
  封面: "xiaojian",
};

const BROADCAST_KEYWORDS = ["大家", "所有人", "都", "全体", "每个人"];

const CONTINUATION_KEYWORDS = [
  "上述",
  "以上",
  "这些",
  "那些",
  "刚才",
  "上一步",
  "前面",
  "根据这些",
  "基于这些",
  "接着",
  "继续",
  "接下来",
  "根据上",
  "基于上",
  "根据刚才",
  "基于刚才",
  "基于前面",
];

const DEFAULT_RECEPTIONIST = "xiaoce";

const FOCUS_DECAY_MESSAGES = 5;
const FOCUS_DECAY_MS = 30_000;

const NICKNAME_MAP: Record<string, EmployeeSlug> = {
  小雷: "xiaolei",
  小策: "xiaoce",
  小资: "xiaozi",
  小文: "xiaowen",
  小检: "xiaojian",
  小神: "xiaoshen",
  小发: "xiaofa",
  小书: "xiaoshu",
  穆兰: "mulan",
};

export function createChatContext(): ChatContext {
  return {
    focusEmployeeId: null,
    focusReason: null,
    focusSetAt: 0,
    lastInteractionMap: {},
  };
}

export function routeByMention(
  message: string,
  participants: Array<{ participantId: string; participantType: string }>
): EmployeeSlug | null {
  const mentionMatch = message.match(/@(\S+)/);
  if (!mentionMatch) return null;

  const mentioned = mentionMatch[1];

  if (NICKNAME_MAP[mentioned]) {
    const slug = NICKNAME_MAP[mentioned];
    const found = participants.find(
      (p) => p.participantType === "ai_employee" && p.participantId === slug
    );
    if (found) return slug;
  }

  const found = participants.find(
    (p) =>
      p.participantType === "ai_employee" &&
      (p.participantId === mentioned ||
        p.participantId.toLowerCase().includes(mentioned.toLowerCase()))
  );
  return found?.participantId ?? null;
}

export function routeByActiveStep(
  activeStepEmployeeId: EmployeeSlug | null
): EmployeeSlug | null {
  return activeStepEmployeeId;
}

export function routeByIntent(message: string): EmployeeSlug | null {
  for (const [keyword, slug] of Object.entries(INTENT_KEYWORD_MAP)) {
    if (message.includes(keyword)) return slug;
  }
  return null;
}

export const WORKFLOW_ORDER: EmployeeSlug[] = [
  "xiaolei",
  "xiaoce",
  "xiaozi",
  "xiaowen",
  "xiaojian",
  "xiaoshen",
  "xiaofa",
  "xiaoshu",
];

export function resolveMultiStepRoute(
  message: string,
  availableSlugs?: string[]
): { slugs: EmployeeSlug[]; missing: { slug: EmployeeSlug; task: string }[] } | null {
  const EMPLOYEE_TASKS: Record<string, string> = {
    xiaolei: "信息检索与资料收集",
    xiaoce: "选题策划与角度分析",
    xiaozi: "素材整理与知识管理",
    xiaowen: "内容撰写与文案创作",
    xiaojian: "视频制作与剪辑方案",
    xiaoshen: "质量检测与内容审核",
    xiaofa: "渠道分发与运营策略",
    xiaoshu: "数据分析与效果追踪",
  };

  const matched = new Set<EmployeeSlug>();
  for (const [keyword, slug] of Object.entries(INTENT_KEYWORD_MAP)) {
    if (message.includes(keyword)) {
      matched.add(slug);
    }
  }
  if (matched.size < 2) return null;

  const ordered = WORKFLOW_ORDER.filter((s) => matched.has(s));
  const missing: { slug: EmployeeSlug; task: string }[] = [];

  if (availableSlugs && availableSlugs.length > 0) {
    for (const slug of ordered) {
      if (!availableSlugs.includes(slug)) {
        missing.push({ slug, task: EMPLOYEE_TASKS[slug] || slug });
      }
    }
  }

  return { slugs: ordered, missing };
}

export function routeByRecentInteraction(
  ctx: ChatContext,
  now: number
): EmployeeSlug | null {
  if (!ctx.focusEmployeeId) return null;

  const elapsed = now - ctx.focusSetAt;
  if (elapsed > FOCUS_DECAY_MS) {
    ctx.focusEmployeeId = null;
    ctx.focusReason = null;
    return null;
  }

  return ctx.focusEmployeeId;
}

export function routeByBroadcast(message: string): boolean {
  return BROADCAST_KEYWORDS.some((kw) => message.includes(kw));
}

export function hasContinuationKeyword(message: string): boolean {
  return CONTINUATION_KEYWORDS.some((kw) => message.includes(kw));
}

export type ContinuationContext = {
  completedSteps: Array<{
    employeeSlug: EmployeeSlug;
    output?: string;
  }>;
};

export function routeByContinuation(
  message: string,
  context: ContinuationContext
): { employeeId: EmployeeSlug; upstreamOutput?: string } | null {
  if (!hasContinuationKeyword(message)) return null;
  if (context.completedSteps.length === 0) return null;

  const lastStep = context.completedSteps[context.completedSteps.length - 1];
  const lastIdx = WORKFLOW_ORDER.indexOf(lastStep.employeeSlug);
  if (lastIdx === -1) return null;

  const nextIdx = lastIdx + 1;
  if (nextIdx >= WORKFLOW_ORDER.length) return null;

  const nextSlug = WORKFLOW_ORDER[nextIdx];
  return {
    employeeId: nextSlug,
    upstreamOutput: lastStep.output,
  };
}

export function resolveRoute(opts: {
  message: string;
  participants: Array<{ participantId: string; participantType: string }>;
  ctx: ChatContext;
  activeStepEmployeeId?: EmployeeSlug | null;
  continuationContext?: ContinuationContext;
  now?: number;
}): RouteResult {
  const { message, participants, ctx, activeStepEmployeeId, continuationContext } = opts;
  const now = opts.now ?? Date.now();

  const mentioned = routeByMention(message, participants);
  if (mentioned) {
    updateFocus(ctx, mentioned, "recent_interaction", now);
    return { type: "direct", employeeId: mentioned };
  }

  if (activeStepEmployeeId) {
    const active = routeByActiveStep(activeStepEmployeeId);
    if (active) {
      return { type: "direct", employeeId: active };
    }
  }

  if (continuationContext) {
    const continuation = routeByContinuation(message, continuationContext);
    if (continuation) {
      const participantSlugs = participants
        .filter((p) => p.participantType === "ai_employee")
        .map((p) => p.participantId);
      if (participantSlugs.includes(continuation.employeeId)) {
        updateFocus(ctx, continuation.employeeId, "recent_interaction", now);
        return { type: "continuation", employeeId: continuation.employeeId, upstreamOutput: continuation.upstreamOutput };
      }
    }
  }

  if (routeByBroadcast(message)) {
    return { type: "broadcast" };
  }

  const intentTarget = routeByIntent(message);
  if (intentTarget) {
    updateFocus(ctx, intentTarget, "recent_interaction", now);
    return { type: "direct", employeeId: intentTarget };
  }

  const recent = routeByRecentInteraction(ctx, now);
  if (recent) {
    return { type: "direct", employeeId: recent };
  }

  return { type: "fallback", employeeId: DEFAULT_RECEPTIONIST };
}

export function updateFocus(
  ctx: ChatContext,
  employeeId: EmployeeSlug,
  reason: "active_step" | "recent_interaction",
  now: number
): void {
  ctx.focusEmployeeId = employeeId;
  ctx.focusReason = reason;
  ctx.focusSetAt = now;
  ctx.lastInteractionMap[employeeId] = now;
}

export function clearFocus(ctx: ChatContext): void {
  ctx.focusEmployeeId = null;
  ctx.focusReason = null;
  ctx.focusSetAt = 0;
}
