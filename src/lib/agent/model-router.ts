import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import type { SkillCategory } from "@/lib/types";
import type { ModelConfig, ModelProvider } from "./types";
import { getSkillModelConfig } from "./skill-model-config";

let _client: ReturnType<typeof createOpenAI> | null = null;

function getClient() {
  if (!_client) {
    const baseURL = process.env.OPENAI_API_BASE_URL || "http://localhost:8000/v1";
    const apiKey = process.env.OPENAI_API_KEY;
    _client = createOpenAI({
      apiKey,
      baseURL,
      fetch: async (url, init) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120_000);
        try {
          return await globalThis.fetch(url as string, { ...init as RequestInit, signal: controller.signal });
        } finally {
          clearTimeout(timeout);
        }
      },
    });
  }
  return _client;
}

function getDefaultModel() {
  return process.env.OPENAI_MODEL || "Qwen3.5-35B-A3B";
}

export interface ModelCapabilities {
  maxContextTokens: number;
  optimalOutputTokens: number;
  supportsToolCalling: boolean;
  recommendedTemperature: Record<string, number>;
  promptStyle: "full" | "concise";
  memoryLimit: number;
}

function getModelCapabilities(modelName: string): ModelCapabilities {
  if (modelName.toLowerCase().includes("qwen")) {
    return {
      maxContextTokens: 32768,
      optimalOutputTokens: 2048,
      supportsToolCalling: true,
      recommendedTemperature: { intent: 0.1, content: 0.5, analysis: 0.3, review: 0.2 },
      promptStyle: "concise",
      memoryLimit: 5,
    };
  }
  return {
    maxContextTokens: 128000,
    optimalOutputTokens: 8192,
    supportsToolCalling: true,
    recommendedTemperature: { intent: 0.2, content: 0.7, analysis: 0.4, review: 0.2 },
    promptStyle: "full",
    memoryLimit: 10,
  };
}

export function getCapabilities(): ModelCapabilities {
  return getModelCapabilities(getDefaultModel());
}

export function resolveModelConfig(
  skillCategories: SkillCategory[],
  override?: Partial<ModelConfig>
): ModelConfig {
  const primaryCategory = skillCategories[0] ?? "info_processing";
  const configFromFile = getSkillModelConfig(primaryCategory);
  const caps = getCapabilities();

  const base: ModelConfig = {
    provider: "openai" as ModelProvider,
    model: getDefaultModel(),
    temperature: 0.3,
    maxTokens: Math.min(configFromFile.maxTokens ?? 4096, caps.optimalOutputTokens),
    ...configFromFile,
  };

  return { ...base, ...override };
}

export function getLanguageModel(config: ModelConfig): LanguageModel {
  return getClient().chat(config.model);
}
