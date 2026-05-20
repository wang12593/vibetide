import { describe, it, expect } from "vitest";
import {
  INTENT_TYPE_LABELS,
  needsGroupConfirmation,
  needsClarification,
  type ChatIntentType,
  type IntentStep,
  type IntentResult,
} from "@/lib/agent/types";

describe("INTENT_TYPE_LABELS", () => {
  it("has Chinese labels for all 8 intent types", () => {
    const expectedTypes: ChatIntentType[] = [
      "information_retrieval",
      "content_creation",
      "deep_analysis",
      "data_analysis",
      "content_review",
      "media_production",
      "publishing",
      "general_chat",
    ];
    for (const t of expectedTypes) {
      expect(INTENT_TYPE_LABELS[t]).toBeDefined();
      expect(INTENT_TYPE_LABELS[t].length).toBeGreaterThan(0);
    }
  });

  it("labels are in Chinese", () => {
    expect(INTENT_TYPE_LABELS.information_retrieval).toBe("信息检索");
    expect(INTENT_TYPE_LABELS.content_creation).toBe("内容创作");
    expect(INTENT_TYPE_LABELS.deep_analysis).toBe("深度分析");
    expect(INTENT_TYPE_LABELS.general_chat).toBe("自由对话");
  });
});

describe("needsGroupConfirmation", () => {
  it("returns true when steps.length > 1", () => {
    const steps = [
      { employeeSlug: "xiaolei", employeeName: "小雷", skills: [], taskDescription: "搜索" },
      { employeeSlug: "xiaowen", employeeName: "小文", skills: [], taskDescription: "写作" },
    ] as IntentStep[];
    expect(needsGroupConfirmation(steps)).toBe(true);
  });

  it("returns false when steps.length <= 1", () => {
    const steps = [
      { employeeSlug: "xiaolei", employeeName: "小雷", skills: [], taskDescription: "搜索" },
    ] as IntentStep[];
    expect(needsGroupConfirmation(steps)).toBe(false);
  });

  it("returns false for empty steps", () => {
    expect(needsGroupConfirmation([])).toBe(false);
  });
});

describe("needsClarification", () => {
  it("returns true when needsClarification is true and questions exist", () => {
    const result = {
      intentType: "content_creation",
      summary: "写文章",
      confidence: 0.8,
      steps: [],
      reasoning: "",
      needsClarification: true,
      clarificationQuestions: [{ id: "q1", field: "topic", question: "什么主题？", options: [] }],
    } as IntentResult;
    expect(needsClarification(result)).toBe(true);
  });

  it("returns false when needsClarification is false", () => {
    const result = {
      intentType: "content_creation",
      summary: "写文章",
      confidence: 0.8,
      steps: [],
      reasoning: "",
      needsClarification: false,
      clarificationQuestions: [{ id: "q1", field: "topic", question: "什么主题？", options: [] }],
    } as IntentResult;
    expect(needsClarification(result)).toBe(false);
  });

  it("returns false when clarificationQuestions is empty", () => {
    const result = {
      intentType: "content_creation",
      summary: "写文章",
      confidence: 0.8,
      steps: [],
      reasoning: "",
      needsClarification: true,
      clarificationQuestions: [],
    } as IntentResult;
    expect(needsClarification(result)).toBe(false);
  });

  it("returns false when clarificationQuestions is undefined", () => {
    const result = {
      intentType: "general_chat",
      summary: "日常对话",
      confidence: 0.95,
      steps: [],
      reasoning: "",
    } as IntentResult;
    expect(needsClarification(result)).toBe(false);
  });
});