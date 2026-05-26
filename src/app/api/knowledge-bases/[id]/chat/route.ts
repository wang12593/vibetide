import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { db } from "@/db";
import { knowledgeBases } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/demo-auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { searchKnowledgeBases } from "@/lib/knowledge/retrieval";
import { getLanguageModel } from "@/lib/agent/model-router";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getCurrentUserOrg();
    const { id: kbId } = await params;

    if (!orgId) {
      return NextResponse.json({ error: "未找到组织" }, { status: 403 });
    }

    const kb = await db.query.knowledgeBases.findFirst({
      where: and(
        eq(knowledgeBases.id, kbId),
        eq(knowledgeBases.organizationId, orgId)
      ),
      columns: { id: true, name: true },
    });
    if (!kb) {
      return NextResponse.json({ error: "知识库不存在或无权访问" }, { status: 404 });
    }

    const body = await request.json();
    const question = (body.question as string)?.trim();
    if (!question) {
      return NextResponse.json({ error: "问题不能为空" }, { status: 400 });
    }

    const hits = await searchKnowledgeBases(question, [kbId], 5);

    if (hits.length === 0) {
      return NextResponse.json({
        answer: "抱歉，知识库中暂未找到与您问题相关的内容。请先上传相关文档后再试。",
        sources: [],
      });
    }

    const context = hits
      .map((h, i) => `[${i + 1}] ${h.snippet}`)
      .join("\n\n");

    const model = getLanguageModel({
      provider: "openai",
      model: process.env.OPENAI_MODEL || "Qwen3.5-35B-A3B",
      temperature: 0.3,
      maxTokens: 2048,
    });

    const { text: answer } = await generateText({
      model,
      prompt: `你是一个知识库问答助手。请根据以下参考资料回答用户的问题。
如果参考资料中没有相关信息，请诚实说明，不要编造内容。
回答时请引用参考资料的编号，例如"根据[1]..."。

参考资料：
${context}

用户问题：${question}

请用中文回答：`,
    });

    return NextResponse.json({
      answer,
      sources: hits.map((h) => ({
        title: h.title,
        snippet: h.snippet.slice(0, 200),
        relevance: Math.round(h.relevance * 100) / 100,
      })),
    });
  } catch (err) {
    console.error("[kb/chat] Error:", err);
    return NextResponse.json({ error: "对话失败" }, { status: 500 });
  }
}
