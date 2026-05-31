import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateText } from "ai";
import { getLanguageModel, resolveModelConfig } from "@/lib/agent/model-router";

export const maxDuration = 30;

const ANALYZE_PARAMS_PROMPT = `你是一个任务参数分析助手。你的职责是分析用户请求，判断执行该任务还需要哪些用户尚未提供的关键信息。

## 规则
1. 从用户消息中提取已有信息（如人物名、事件、风格、平台等）
2. 根据任务类型，判断还缺少哪些关键参数
3. 只列出**真正缺失且必要**的参数，不要问用户已经提供的信息
4. 如果用户消息中已有足够信息，返回空数组
5. 问题数量控制在 3-8 个
6. 每个问题必须包含完整的表单字段定义

## 输出格式（严格JSON，不要markdown代码块）
{
  "extracted": { "已提取字段": "值" },
  "questions": [
    {
      "id": "q_字段名",
      "field": "字段名",
      "question": "中文问题（带冒号）",
      "inputType": "text | textarea | select",
      "placeholder": "输入提示",
      "options": [],
      "allowCustom": true
    }
  ]
}

## 常见任务类型参考参数

### 人物评论/报道类
- personName（人物姓名）— text
- personTitle（职务岗位）— text
- personUnit（所在单位）— text
- achievements（主要事迹）— textarea
- keyEvents（关键事件）— textarea
- honors（所获荣誉）— textarea
- propagandaFocus（宣传重点/角度）— text

### 事件报道类
- eventName（事件名称）— text
- eventTime（发生时间）— text
- eventLocation（发生地点）— text
- keyFigures（关键人物）— text
- eventDetails（事件详情）— textarea
- reportingAngle（报道角度）— text

### 内容分发/渠道类
- platform（目标平台）— select（微博/今日头条/B站/小红书/知乎/百家号）
- contentType（内容类型）— text
- targetAudience（目标受众）— text
- toneStyle（语调风格）— text

### 通用
- topic（主题）— text
- keywords（关键词）— text
- wordCount（字数要求）— text
- deadline（截止时间）— text
- specialRequirements（特殊要求）— textarea`;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { userMessage, taskContext, workflowName, workflowDescription } = body as {
      userMessage: string;
      taskContext?: string;
      workflowName?: string;
      workflowDescription?: string;
    };

    if (!userMessage) {
      return NextResponse.json({ error: "userMessage is required" }, { status: 400 });
    }

    const contextParts: string[] = [];
    if (workflowName) contextParts.push(`匹配到的场景：「${workflowName}」`);
    if (workflowDescription) contextParts.push(`场景描述：${workflowDescription}`);
    if (taskContext) contextParts.push(`任务上下文：${taskContext}`);

    const contextBlock = contextParts.length > 0
      ? `\n\n## 任务上下文\n${contextParts.join("\n")}`
      : "";

    const prompt = `${ANALYZE_PARAMS_PROMPT}${contextBlock}

## 用户消息
${userMessage}

请分析上述用户消息，输出JSON：`;

    const modelConfig = resolveModelConfig(["info_processing"], {
      temperature: 0.1,
      maxTokens: 1024,
    });
    const model = getLanguageModel(modelConfig);

    const { text } = await generateText({ model, prompt });

    let parsed: { extracted: Record<string, string>; questions: Array<{
      id: string;
      field: string;
      question: string;
      inputType: string;
      placeholder: string;
      options?: Array<{ label: string; value: string }>;
      allowCustom?: boolean;
    }> };

    const jsonStr = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        return NextResponse.json({ extracted: {}, questions: [] });
      }
    }

    if (!Array.isArray(parsed.questions)) {
      parsed.questions = [];
    }

    parsed.questions = parsed.questions.map((q) => ({
      id: q.id || `q_${q.field}`,
      field: q.field,
      question: q.question,
      inputType: q.inputType || "text",
      placeholder: q.placeholder || "",
      options: q.options || [],
      allowCustom: q.allowCustom ?? true,
    }));

    console.log(`[analyze-params] extracted=${JSON.stringify(parsed.extracted)} questions=${parsed.questions.length}`);

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[analyze-params] Error:", err);
    return NextResponse.json(
      { error: "Parameter analysis failed" },
      { status: 500 }
    );
  }
}
