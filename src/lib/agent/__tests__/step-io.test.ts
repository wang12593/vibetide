import { describe, it, expect } from "vitest";
import {
  extractQualityScore,
  parseStepOutput,
  serializeStepOutput,
  deserializeStepOutput,
} from "@/lib/agent/step-io";
import type { EmployeeId } from "@/lib/constants";

describe("extractQualityScore", () => {
  it("extracts score from Chinese brackets with colon", () => {
    expect(extractQualityScore("正文内容【质量自评：85/100】结束")).toBe(85);
  });

  it("extracts score from Chinese brackets with fullwidth colon", () => {
    expect(extractQualityScore("【质量自评：92/100】")).toBe(92);
  });

  it("extracts score with slashes", () => {
    expect(extractQualityScore("【质量自评： 78 ／ 100】")).toBe(78);
  });

  it("returns undefined when no quality score present", () => {
    expect(extractQualityScore("这是一篇普通的输出，没有自评分数")).toBeUndefined();
  });

  it("returns undefined for out-of-range score (> 100)", () => {
    expect(extractQualityScore("【质量自评：150/100】")).toBeUndefined();
  });

  it("returns undefined for negative score", () => {
    expect(extractQualityScore("【质量自评：-5/100】")).toBeUndefined();
  });

  it("returns undefined for empty text", () => {
    expect(extractQualityScore("")).toBeUndefined();
  });

  it("handles score of 0", () => {
    expect(extractQualityScore("【质量自评：0/100】")).toBe(0);
  });

  it("handles score of 100", () => {
    expect(extractQualityScore("【质量自评：100/100】")).toBe(100);
  });
});

describe("parseStepOutput", () => {
  const employeeSlug = "xiaowen" as EmployeeId;

  it("parses step output with content", () => {
    const result = parseStepOutput("这是第一行标题\n\n这是具体内容。", "create", employeeSlug);
    expect(result.stepKey).toBe("create");
    expect(result.employeeSlug).toBe("xiaowen");
    expect(result.summary).toBe("这是第一行标题");
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0].type).toBe("article_draft");
    expect(result.status).toBe("success");
  });

  it("maps stepKey to artifact type correctly", () => {
    const stepKeyMap: Record<string, string> = {
      monitor: "hot_topic_list",
      plan: "topic_angles",
      material: "material_brief",
      create: "article_draft",
      review: "review_report",
    };

    for (const [stepKey, expectedType] of Object.entries(stepKeyMap)) {
      const result = parseStepOutput("测试内容", stepKey, employeeSlug);
      expect(result.artifacts[0].type).toBe(expectedType);
    }
  });

  it("uses 'generic' artifact type for unknown stepKeys", () => {
    const result = parseStepOutput("测试内容", "unknown_step", employeeSlug);
    expect(result.artifacts[0].type).toBe("generic");
  });

  it("falls back to 步骤已完成 for empty output", () => {
    const result = parseStepOutput("", "plan", employeeSlug);
    expect(result.summary).toBe("步骤已完成");
  });

  it("trims markdown heading from summary", () => {
    const result = parseStepOutput("## 深度研究报告\n\n正文内容", "analyze", employeeSlug);
    expect(result.summary).toBe("深度研究报告");
  });

  it("calculates word count correctly from Chinese text", () => {
    const result = parseStepOutput("这是一段中文测试文本用于字数计算", "create", employeeSlug);
    expect(result.metrics!.wordCount).toBe(16);
  });

  it("extracts quality score from output text", () => {
    const result = parseStepOutput("## 报告\n正文\n\n【质量自评：90/100】", "review", employeeSlug);
    expect(result.metrics!.qualityScore).toBe(90);
  });

  it("sets qualityScore to undefined when not present", () => {
    const result = parseStepOutput("普通文本没有自评", "create", employeeSlug);
    expect(result.metrics!.qualityScore).toBeUndefined();
  });

  it("generates artifact id with stepKey prefix", () => {
    const result = parseStepOutput("内容", "monitor", employeeSlug);
    expect(result.artifacts[0].id).toMatch(/^monitor-/);
  });

  it("uses generic artifact type for produce step", () => {
    const result = parseStepOutput("视频脚本内容", "produce", employeeSlug);
    expect(result.artifacts[0].type).toBe("video_script");
  });

  it("handles publish step mapping", () => {
    const result = parseStepOutput("发布计划内容", "publish", employeeSlug);
    expect(result.artifacts[0].type).toBe("publish_plan");
  });
});

describe("serializeStepOutput", () => {
  it("serializes to JSON string", () => {
    const output = {
      stepKey: "test",
      employeeSlug: "xiaolei" as EmployeeId,
      summary: "测试",
      artifacts: [],
      metrics: { wordCount: 10, qualityScore: 80 },
      status: "success" as const,
    };
    const serialized = serializeStepOutput(output);
    expect(typeof serialized).toBe("string");
    expect(JSON.parse(serialized)).toMatchObject({
      stepKey: "test",
      summary: "测试",
      metrics: { wordCount: 10, qualityScore: 80 },
    });
  });
});

describe("deserializeStepOutput", () => {
  it("deserializes from JSON", () => {
    const json = {
      stepKey: "test",
      employeeSlug: "xiaolei",
      summary: "测试",
      artifacts: [],
      metrics: {},
      status: "success",
    };
    const result = deserializeStepOutput(json);
    expect(result).not.toBeNull();
    expect(result!.stepKey).toBe("test");
  });

  it("returns null for null input", () => {
    expect(deserializeStepOutput(null)).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(deserializeStepOutput("string")).toBeNull();
  });
});