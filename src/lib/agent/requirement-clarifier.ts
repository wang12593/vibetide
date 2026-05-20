import { generateText } from "ai";
import { getLanguageModel } from "./model-router";
import type {
  ChatIntentType,
  ClarificationSession,
  ClarificationRound,
  RequirementParameter,
} from "./types";
import {
  getTemplateForIntent,
  REQUIREMENT_TEMPLATES,
} from "./requirement-templates";
import { extractParameters } from "./requirement-extractor";

export function shouldSkipClarification(message: string): boolean {
  return message.length > 50;
}

export function isClarificationEnabled(): boolean {
  return process.env.VIBETIDE_REQUIREMENT_CLARIFICATION_ENABLED === "true";
}

export function getMissingRequiredParameters(
  session: ClarificationSession
): RequirementParameter[] {
  const template = REQUIREMENT_TEMPLATES[session.intentType];
  if (!template) return [];
  return template.required.filter(
    (p) => !session.parameters[p.field] || session.parameters[p.field].trim() === ""
  );
}

export async function generateClarificationQuestion(
  session: ClarificationSession
): Promise<string> {
  const template = REQUIREMENT_TEMPLATES[session.intentType];
  if (!template) return "";

  const missing = getMissingRequiredParameters(session);
  if (missing.length === 0) return "";

  const missingDesc = missing
    .map((p) => {
      let desc = `${p.label}（${p.field}）`;
      if (p.options) {
        desc += `，可选：${p.options.map((o) => o.label).join("/")}`;
      }
      return desc;
    })
    .join("、");

  const existingContext = Object.entries(session.parameters)
    .filter(([, v]) => v.trim() !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("，");

  const result = await generateText({
    model: getLanguageModel({
      provider: "openai",
      model: process.env.OPENAI_MODEL || "Qwen3.5-35B-A3B",
      temperature: 0,
      maxTokens: 128,
    }),
    system: `你是一个需求澄清助手。根据缺失的参数，生成一个简洁自然的中文提问，引导用户补充信息。
只返回提问文本，不要包含其他内容。一次只问一个最关键的缺失参数。`,
    messages: [
      {
        role: "user",
        content: `意图：${template.label}\n已有信息：${existingContext || "无"}\n缺失参数：${missingDesc}`,
      },
    ],
    temperature: 0,
    maxOutputTokens: 128,
  });

  return result.text.trim();
}

export async function initSession(
  message: string,
  intentType: ChatIntentType,
  conversationId: string
): Promise<ClarificationSession> {
  const template = getTemplateForIntent(intentType);
  const now = Date.now();

  const session: ClarificationSession = {
    id: crypto.randomUUID(),
    conversationId,
    intentType,
    parameters: {},
    rounds: [],
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  if (!template) {
    session.status = "skipped";
    return session;
  }

  const { extracted, missing } = await extractParameters(message, template);
  session.parameters = extracted;

  if (missing.length === 0) {
    session.status = "confirmed";
  } else {
    session.rounds.push({
      role: "system",
      content: message,
      timestamp: now,
    });
    const question = await generateClarificationQuestion(session);
    session.rounds.push({
      role: "system",
      content: question,
      timestamp: Date.now(),
    });
  }

  session.updatedAt = Date.now();
  return session;
}

export async function processResponse(
  userMessage: string,
  session: ClarificationSession
): Promise<ClarificationSession> {
  const template = REQUIREMENT_TEMPLATES[session.intentType];
  if (!template || session.status !== "active") return session;

  session.rounds.push({
    role: "user",
    content: userMessage,
    timestamp: Date.now(),
  });

  const { extracted } = await extractParameters(userMessage, template);
  session.parameters = { ...session.parameters, ...extracted };

  const missing = getMissingRequiredParameters(session);
  if (missing.length === 0) {
    session.status = "confirmed";
  } else {
    const question = await generateClarificationQuestion(session);
    session.rounds.push({
      role: "system",
      content: question,
      timestamp: Date.now(),
    });
  }

  session.updatedAt = Date.now();
  return session;
}
