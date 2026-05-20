import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { userProfiles, organizations } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import {
  initSession,
  processResponse,
  isClarificationEnabled,
} from "@/lib/agent/requirement-clarifier";
import type { ChatIntentType } from "@/lib/agent/types";
import {
  getActiveClarificationSession,
  upsertClarificationSession,
} from "@/lib/dal/clarification-sessions";

const INTENT_KEYWORDS: Array<{
  pattern: RegExp;
  intentType: ChatIntentType;
}> = [
  { pattern: /^(搜索|搜一下|查一下|帮我查|搜搜|有什么|看看).*/i, intentType: "information_retrieval" },
  { pattern: /^(写一篇|写个|帮我写|生成).*(文章|稿|报道|文案|新闻|内容)/i, intentType: "content_creation" },
  { pattern: /^(写|创作|生成|撰写|起草).*(文|稿|章)/i, intentType: "content_creation" },
  { pattern: /^(分析|解读|对比|盘点|拆解|洞察).*(数据|报告|趋势|内容|文章)/i, intentType: "deep_analysis" },
  { pattern: /^(分析|解读|研究).*/i, intentType: "deep_analysis" },
  { pattern: /(数据|统计|趋势|报表|指标|图表).*(分析|报告|统计)/i, intentType: "data_analysis" },
  { pattern: /^(审核|检查|评估|审校|质检).*/i, intentType: "content_review" },
  { pattern: /^(制作|剪辑|拍|录|配音|分镜).*(视频|音频|图片|短片)/i, intentType: "media_production" },
  { pattern: /^(发布|分发|推送|运营|推广).*/i, intentType: "publishing" },
];

function classifyIntent(message: string): ChatIntentType {
  const trimmed = message.trim();
  for (const rule of INTENT_KEYWORDS) {
    if (rule.pattern.test(trimmed)) return rule.intentType;
  }
  return "general_chat";
}

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

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const orgId = await resolveOrgId(user.id);
  if (!orgId) {
    return new Response("Organization not found", { status: 403 });
  }

  if (!isClarificationEnabled()) {
    return new Response(
      JSON.stringify({ error: "Requirement clarification is not enabled" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { message?: unknown; conversationId?: unknown; sessionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const message = String(body.message || "").trim();
  if (!message) {
    return new Response("消息内容不能为空", { status: 400 });
  }

  const conversationId = typeof body.conversationId === "string" ? body.conversationId : undefined;
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined;

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
          // Controller already closed
        }
      };

      try {
        if (sessionId) {
          const existingSession = await getActiveClarificationSession(sessionId, orgId);
          if (!existingSession) {
            send("error", { message: "会话不存在或已过期，请重新开始" });
            controller.close();
            return;
          }

          const agentSession = {
            id: existingSession.id,
            conversationId: existingSession.conversationId ?? "",
            intentType: existingSession.intentType as ChatIntentType,
            parameters: (existingSession.parameters ?? {}) as Record<string, string>,
            rounds: (existingSession.rounds ?? []) as { role: "system" | "user"; content: string; timestamp: number }[],
            status: existingSession.status as "active" | "confirmed" | "skipped" | "expired",
            createdAt: existingSession.createdAt.getTime(),
            updatedAt: existingSession.updatedAt.getTime(),
          };

          const updated = await processResponse(message, agentSession);

          await upsertClarificationSession({
            id: updated.id,
            organizationId: orgId,
            conversationId,
            intentType: updated.intentType,
            parameters: updated.parameters,
            rounds: updated.rounds,
            status: updated.status,
          });

          if (updated.status === "confirmed") {
            send("clarification-complete", {
              sessionId: updated.id,
              parameters: updated.parameters,
            });
          } else {
            const lastSystemRound = [...updated.rounds]
              .reverse()
              .find((r) => r.role === "system");
            send("clarification-question", {
              sessionId: updated.id,
              question: lastSystemRound?.content ?? "",
              parameters: updated.parameters,
            });
          }

          send("parameter-update", {
            sessionId: updated.id,
            parameters: updated.parameters,
          });
        } else {
          const intentType = classifyIntent(message);
          const session = await initSession(message, intentType, conversationId ?? "");

          await upsertClarificationSession({
            id: session.id,
            organizationId: orgId,
            conversationId,
            intentType: session.intentType,
            parameters: session.parameters,
            rounds: session.rounds,
            status: session.status,
            originalMessage: message,
          });

          if (session.status === "confirmed" || session.status === "skipped") {
            send("clarification-complete", {
              sessionId: session.id,
              parameters: session.parameters,
            });
          } else {
            const lastSystemRound = [...session.rounds]
              .reverse()
              .find((r) => r.role === "system" && r !== session.rounds[0]);
            send("clarification-question", {
              sessionId: session.id,
              question: lastSystemRound?.content ?? "",
              parameters: session.parameters,
            });
          }

          send("parameter-update", {
            sessionId: session.id,
            parameters: session.parameters,
          });
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
