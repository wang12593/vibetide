import { generateText } from "ai";
import { getLanguageModel } from "./model-router";
import type {
  RequirementTemplate,
  RequirementParameter,
} from "./types";

function buildFieldList(template: RequirementTemplate): string {
  const all = [...template.required, ...template.optional];
  return all.map((p) => `- ${p.field}（${p.label}，类型：${p.type}${p.options ? `，可选值：${p.options.map((o) => o.value).join("/")}` : ""}）`).join("\n");
}

export async function extractParameters(
  message: string,
  template: RequirementTemplate
): Promise<{
  extracted: Record<string, string>;
  missing: RequirementParameter[];
}> {
  const fieldList = buildFieldList(template);

  const result = await generateText({
    model: getLanguageModel({
      provider: "openai",
      model: process.env.OPENAI_MODEL || "Qwen3.5-35B-A3B",
      temperature: 0,
      maxTokens: 256,
    }),
    system: `你是一个参数提取器。从用户消息中提取以下参数的值。
只返回 JSON，不要返回其他内容。格式：{ "field": "value" }
如果某个参数在消息中找不到，不要包含在结果中。

可提取的参数：
${fieldList}`,
    messages: [{ role: "user", content: message }],
    temperature: 0,
    maxOutputTokens: 256,
  });

  let extracted: Record<string, string> = {};
  try {
    let text = result.text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    extracted = JSON.parse(text);
    if (typeof extracted !== "object" || Array.isArray(extracted)) {
      extracted = {};
    }
  } catch {
    extracted = {};
  }

  const missing = template.required.filter(
    (p) => !extracted[p.field] || extracted[p.field].trim() === ""
  );

  return { extracted, missing };
}
