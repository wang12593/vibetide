import { describe, it, expect } from "vitest";
import { chunkText, buildSnippet } from "@/lib/knowledge/chunking";

describe("chunkText — 高级边界用例", () => {
  it("handles very long sentence exceeding maxChars", () => {
    const longSentence = "这是一句超长文本没有任何标点符号".repeat(200);
    const chunks = chunkText(longSentence);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    chunks.forEach((c) => {
      expect(c.length).toBeLessThanOrEqual(800 + 100);
    });
  });

  it("preserves overlap between consecutive chunks", () => {
    const para = "段落内容测试文本。".repeat(200);
    const chunks = chunkText(para);
    if (chunks.length > 1) {
      const overlapText = chunks[0].slice(-50);
      expect(chunks[1].includes(overlapText) || chunks[1].startsWith(overlapText)).toBe(true);
    }
  });

  it("handles mixed CJK and Latin characters", () => {
    const mixed = "English text 中文内容日本語 한국어\n\n第二段 more text 更多中文";
    const chunks = chunkText(mixed);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0]).toContain("English");
    expect(chunks[0]).toContain("中文内容");
  });

  it("splits multiple paragraphs into multiple chunks", () => {
    const paragraphs = Array.from({ length: 10 }, (_, i) => `第${i + 1}段内容重复填充测试文本。`.repeat(30)).join("\n\n");
    const chunks = chunkText(paragraphs);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it("handles text with only newlines and whitespace", () => {
    expect(chunkText("\n\n\n\n")).toEqual([]);
    expect(chunkText("  \n  \n  ")).toEqual([]);
  });

  it("handles text with special characters", () => {
    const special = "测试<script>alert('xss')</script>\n\n第二段【特殊】符号★☆{" + "}".repeat(100);
    const chunks = chunkText(special);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });
});

describe("buildSnippet", () => {
  const longText = "这是一段很长的测试文本，用于验证摘要构建功能。".repeat(50);

  it("truncates with ellipsis when text exceeds maxLength", () => {
    const snippet = buildSnippet(longText);
    expect(snippet.length).toBe(201);
    expect(snippet.endsWith("…")).toBe(true);
  });

  it("respects custom maxLength", () => {
    const snippet = buildSnippet(longText, 50);
    expect(snippet.length).toBe(51);
    expect(snippet.endsWith("…")).toBe(true);
  });

  it("returns full text when shorter than maxLength", () => {
    const short = "短文本";
    expect(buildSnippet(short, 200)).toBe(short);
  });

  it("handles empty text", () => {
    expect(buildSnippet("", 100)).toBe("");
  });

  it("trims whitespace and collapses multiple spaces", () => {
    const spaced = "   hello    world   ";
    const snippet = buildSnippet(spaced, 200);
    expect(snippet).toBe("hello world");
  });
});