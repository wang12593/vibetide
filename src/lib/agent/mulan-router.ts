import type { AssembledAgent } from "./types";
import type { EmployeeId } from "@/lib/constants";

export interface RoutingContext {
  summary: string;
  intentType: string;
  requiredSkills: string[];
  userMessage: string;
  mulanAnalysis: string;
}

export function buildRoutingContext(
  intentType: string,
  userMessage: string,
  mulanAnalysis: string,
  requiredSkills: string[]
): RoutingContext {
  return {
    summary: mulanAnalysis,
    intentType,
    requiredSkills,
    userMessage,
    mulanAnalysis,
  };
}

export function buildRoutedSystemPrompt(
  targetAgent: AssembledAgent,
  context: RoutingContext
): string {
  const routingNote = `

## 穆兰转交说明
穆兰（主智能体）已分析用户意图并将此任务转交给你处理。
- 用户原始消息：${context.userMessage}
- 意图类型：${context.intentType}
- 穆兰分析结论：${context.mulanAnalysis}
- 需要使用的技能：${context.requiredSkills.join("、") || "由你判断"}
请基于以上上下文继续处理用户的需求。`;

  return targetAgent.systemPrompt + routingNote;
}

export function isLeaderSlug(slug: string): boolean {
  return slug === "leader" || slug === "mulan";
}

export const EMPLOYEE_SLUG_MAP: Record<string, EmployeeId> = {
  information_retrieval: "xiaolei",
  content_creation: "xiaowen",
  deep_analysis: "xiaoce",
  data_analysis: "xiaoshu",
  content_review: "xiaoshen",
  media_production: "xiaojian",
  publishing: "xiaofa",
  topic_planning: "xiaoce",
  general_chat: "leader",
};

export function resolveTargetEmployee(intentType: string, preferredSlug?: string): EmployeeId {
  if (preferredSlug && preferredSlug !== "leader" && preferredSlug !== "mulan") {
    return preferredSlug as EmployeeId;
  }
  return EMPLOYEE_SLUG_MAP[intentType] || "leader";
}
