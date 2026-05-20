import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getCapabilities, resolveModelConfig } from "@/lib/agent/model-router";

describe("model-router", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getCapabilities", () => {
    it("returns Qwen capabilities when model contains qwen", () => {
      process.env.OPENAI_MODEL = "Qwen3.5-35B-A3B";
      const caps = getCapabilities();
      expect(caps.maxContextTokens).toBe(32768);
      expect(caps.optimalOutputTokens).toBe(2048);
      expect(caps.supportsToolCalling).toBe(true);
      expect(caps.memoryLimit).toBe(5);
      expect(caps.promptStyle).toBe("concise");
    });

    it("returns default capabilities for non-Qwen models", () => {
      process.env.OPENAI_MODEL = "gpt-4o";
      const caps = getCapabilities();
      expect(caps.maxContextTokens).toBe(128000);
      expect(caps.optimalOutputTokens).toBe(8192);
      expect(caps.supportsToolCalling).toBe(true);
      expect(caps.memoryLimit).toBe(10);
      expect(caps.promptStyle).toBe("full");
    });

    it("falls back to Qwen capabilities when model is not set", () => {
      delete process.env.OPENAI_MODEL;
      const caps = getCapabilities();
      expect(caps.maxContextTokens).toBeGreaterThan(0);
      expect(caps.supportsToolCalling).toBe(true);
    });

    it("provides recommendedTemperature for all task types", () => {
      const caps = getCapabilities();
      expect(caps.recommendedTemperature).toBeDefined();
      expect(caps.recommendedTemperature.intent).toBeDefined();
      expect(caps.recommendedTemperature.content).toBeDefined();
      expect(caps.recommendedTemperature.analysis).toBeDefined();
      expect(caps.recommendedTemperature.review).toBeDefined();
    });
  });

  describe("resolveModelConfig", () => {
    it("uses info_processing as default category when empty array", () => {
      const config = resolveModelConfig([]);
      expect(config.provider).toBe("openai");
      expect(config.model).toBeDefined();
      expect(config.temperature).toBeDefined();
      expect(config.maxTokens).toBeGreaterThan(0);
    });

    it("uses the first category for primary config", () => {
      const config = resolveModelConfig(["info_perception"]);
      expect(config.model).toBeDefined();
    });

    it("applies temperature override", () => {
      const config = resolveModelConfig(["info_processing"], { temperature: 0.9 });
      expect(config.temperature).toBe(0.9);
    });

    it("applies model override", () => {
      const config = resolveModelConfig(["info_processing"], { model: "gpt-4o" });
      expect(config.model).toBe("gpt-4o");
    });

    it("passes maxTokens override as-is (no upper cap)", () => {
      const config = resolveModelConfig(["info_processing"], { maxTokens: 99999 });
      expect(config.maxTokens).toBe(99999);
    });

    it("handles multimodal category", () => {
      const config = resolveModelConfig(["multimodal"]);
      expect(config.provider).toBe("openai");
      expect(config.maxTokens).toBeGreaterThan(0);
    });
  });
});