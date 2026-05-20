import type { SkillCategory } from "@/lib/types";
import type { ModelConfig } from "./types";

export interface SkillModelConfig {
  [category: string]: Partial<ModelConfig>;
}

const isQwen = (process.env.OPENAI_MODEL || "").toLowerCase().includes("qwen");

const QWEN_MAX_TOKENS = 2048;
const DEFAULT_MAX_TOKENS = 4096;
const CONTENT_MAX_TOKENS = isQwen ? 2048 : 8192;

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "Qwen3.5-35B-A3B";

export const SKILL_MODEL_CONFIG: SkillModelConfig = {
  info_perception: {
    provider: "openai",
    model: process.env.SKILL_MODEL_WEB_SEARCH || DEFAULT_MODEL,
    temperature: isQwen ? 0.1 : 0.3,
    maxTokens: DEFAULT_MAX_TOKENS,
  },
  info_processing: {
    provider: "openai",
    model: process.env.SKILL_MODEL_CONTENT_GEN || DEFAULT_MODEL,
    temperature: isQwen ? 0.5 : 0.7,
    maxTokens: CONTENT_MAX_TOKENS,
  },
  system_interop: {
    provider: "openai",
    model: process.env.SKILL_MODEL_DISTRIBUTION || DEFAULT_MODEL,
    temperature: isQwen ? 0.2 : 0.3,
    maxTokens: DEFAULT_MAX_TOKENS,
  },
  automation: {
    provider: "openai",
    model: process.env.SKILL_MODEL_OTHER || DEFAULT_MODEL,
    temperature: isQwen ? 0.2 : 0.3,
    maxTokens: DEFAULT_MAX_TOKENS,
  },
  communication: {
    provider: "openai",
    model: DEFAULT_MODEL,
    temperature: isQwen ? 0.2 : 0.3,
    maxTokens: DEFAULT_MAX_TOKENS,
  },
  multimodal: {
    provider: "openai",
    model: process.env.SKILL_MODEL_AV_SCRIPT || DEFAULT_MODEL,
    temperature: isQwen ? 0.5 : 0.7,
    maxTokens: CONTENT_MAX_TOKENS,
  },
  other: {
    provider: "openai",
    model: process.env.SKILL_MODEL_OTHER || DEFAULT_MODEL,
    temperature: isQwen ? 0.2 : 0.3,
    maxTokens: DEFAULT_MAX_TOKENS,
  },
};

export function getSkillModelConfig(category: SkillCategory): Partial<ModelConfig> {
  return SKILL_MODEL_CONFIG[category] || SKILL_MODEL_CONFIG.other;
}
