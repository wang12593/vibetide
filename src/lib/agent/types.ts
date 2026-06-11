import type { EmployeeId } from "@/lib/constants";
import type { AuthorityLevel, SkillCategory } from "@/lib/types";

// ---------------------------------------------------------------------------
// Model Configuration
// ---------------------------------------------------------------------------

export type ModelProvider = "openai";

export interface ModelConfig {
  provider: ModelProvider;
  model: string;
  temperature: number;
  maxTokens: number;
}

// ---------------------------------------------------------------------------
// Agent Tool
// ---------------------------------------------------------------------------

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute?: (args: Record<string, unknown>) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Assembled Agent (ready to execute)
// ---------------------------------------------------------------------------

export interface EmployeeMemoryEntry {
  content: string;
  memoryType: string;
  importance: number;
}

export interface AssembledAgent {
  employeeId: string;
  organizationId?: string;
  slug: EmployeeId;
  name: string;
  nickname: string;
  title: string;
  systemPrompt: string;
  tools: AgentTool[];
  modelConfig: ModelConfig;
  knowledgeContext: string;
  authorityLevel: AuthorityLevel;
  skillCategories: SkillCategory[];
  memories: EmployeeMemoryEntry[];
  proficiencyLevel: number; // average skill level 0-100
  workPreferences?: {
    proactivity: string;
    reportingFrequency: string;
    autonomyLevel: number;
    communicationStyle: string;
    workingHours: string;
    /** Custom instructions for custom employees — appended to Identity layer */
    customInstructions?: string;
  } | null;
  sensitiveTopics?: string[];
  skillContents?: Record<string, string>;
  pluginConfigs?: Map<string, { description: string; config: {
    endpoint: string;
    method?: "GET" | "POST";
    headers?: Record<string, string>;
    authType?: "none" | "api_key" | "bearer";
    authKey?: string;
    requestTemplate?: string;
    responseMapping?: Record<string, string>;
    timeoutMs?: number;
  } }>;
  /**
   * IDs of knowledge bases bound to this employee.
   * When non-empty, the kb_search tool is auto-injected at execution time.
   */
  knowledgeBaseIds?: string[];
  userProfile?: {
    frequentIntents: { intentType: string; count: number }[];
    preferredAssignments: {
      intentType: string;
      steps: { employeeSlug: string; skills: string[] }[];
      userConfirmed: number;
    }[];
    communicationPreference?: string;
  };
}

// ---------------------------------------------------------------------------
// Step I/O
// ---------------------------------------------------------------------------

export type ArtifactType =
  | "hot_topic_list"
  | "topic_angles"
  | "material_brief"
  | "article_draft"
  | "video_script"
  | "review_report"
  | "publish_plan"
  | "analytics_report"
  | "generic";

export interface StepArtifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
}

export interface StepOutput {
  stepKey: string;
  employeeSlug: EmployeeId;
  summary: string;
  artifacts: StepArtifact[];
  metrics?: {
    qualityScore?: number;
    wordCount?: number;
  };
  status: "success" | "partial" | "needs_approval";
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export interface AgentExecutionInput {
  stepKey: string;
  stepLabel: string;
  scenario: string;
  topicTitle: string;
  previousSteps: StepOutput[];
  userInstructions?: string;
  /**
   * Body of the SKILL.md that this step must execute. When set, it's appended
   * to the agent's system prompt as "必须遵守的当前步骤执行规范" so the LLM
   * follows the skill's workflow checklist + output schema as a hard constraint
   * rather than an "additional instruction" buried in the user message.
   */
  skillSpec?: string;
}

export interface AgentExecutionResult {
  output: StepOutput;
  tokensUsed: { input: number; output: number };
  durationMs: number;
  toolCallCount: number;
}

export type ProgressCallback = (progress: {
  percent: number;
  message: string;
}) => void;

// ---------------------------------------------------------------------------
// Intent Recognition (extracted here so client components can import types
// without pulling in server-only modules like skill-loader)
// ---------------------------------------------------------------------------

export type ChatIntentType =
  | "information_retrieval"
  | "content_creation"
  | "deep_analysis"
  | "data_analysis"
  | "content_review"
  | "media_production"
  | "publishing"
  | "general_chat";

export interface IntentStep {
  employeeSlug: EmployeeId;
  employeeName: string;
  skills: string[];
  taskDescription: string;
  dependsOn?: number;
}

export type MulanRouteTarget =
  | { kind: "llm"; reason: string }
  | { kind: "employee"; employeeSlug: EmployeeId; reason: string; confidence: number }
  | { kind: "scenario"; scenarioId: string; scenarioName?: string; reason: string; confidence: number }
  | {
      kind: "mission";
      title: string;
      employeeSlugs: EmployeeId[];
      scenarioId?: string;
      reason: string;
      confidence: number;
    };

export interface ClarificationOption {
  label: string;
  value: string;
}

export interface ClarificationQuestion {
  id: string;
  field: string;
  question: string;
  options: ClarificationOption[];
  allowCustom?: boolean;
  placeholder?: string;
  inputType?: "text" | "textarea" | "number" | "select";
}

export interface IntentResult {
  intentType: ChatIntentType;
  summary: string;
  confidence: number;
  steps: IntentStep[];
  reasoning: string;
  originalMessage?: string;
  /** If the intent matches a configured workflow, these fields are populated */
  workflowId?: string;
  workflowName?: string;
  executionMode?: "skill" | "workflow" | "auto";
  /** Canonical Mulan route target. Kept alongside legacy fields during migration. */
  routeTarget?: MulanRouteTarget;
  /** When required input fields are missing, the LLM can request clarification */
  needsClarification?: boolean;
  /** When true, frontend should call /api/chat/analyze-params to get dynamic questions */
  needsParamAnalysis?: boolean;
  clarificationQuestions?: ClarificationQuestion[];
  /** History of multi-turn clarification Q&A pairs */
  clarificationHistory?: Array<{ question: string; answer: string }>;
  /** Structured user inputs from clarification answers (field name → value) */
  userInputs?: Record<string, string>;
}

/** Frontend state for multi-turn clarification */
export interface MultiTurnState {
  active: boolean;
  round: number;
  history: Array<{ question: string; answer: string }>;
}

export const INTENT_TYPE_LABELS: Record<ChatIntentType, string> = {
  information_retrieval: "信息检索",
  content_creation: "内容创作",
  deep_analysis: "深度分析",
  data_analysis: "数据分析",
  content_review: "内容审核",
  media_production: "媒体制作",
  publishing: "发布分发",
  general_chat: "自由对话",
};

export function needsGroupConfirmation(steps: IntentStep[]): boolean {
  return steps.length > 1;
}

export function needsClarification(result: IntentResult): boolean {
  return !!result.needsClarification && (result.clarificationQuestions?.length ?? 0) > 0;
}

export function needsMultiTurnClarification(result: IntentResult): boolean {
  return !!result.needsClarification && (result.clarificationQuestions?.length ?? 0) > 0 && !result.clarificationHistory;
}

// ---------------------------------------------------------------------------
// Requirement Clarification (多轮需求澄清)
// ---------------------------------------------------------------------------

export interface RequirementParameter {
  field: string;
  label: string;
  type: "text" | "textarea" | "number" | "select";
  required: boolean;
  options?: { label: string; value: string }[];
  placeholder?: string;
  value?: string;
}

export interface RequirementTemplate {
  intentType: ChatIntentType;
  label: string;
  required: RequirementParameter[];
  optional: RequirementParameter[];
}

export interface ClarificationRound {
  role: "system" | "user";
  content: string;
  timestamp: number;
}

export interface ClarificationSession {
  id: string;
  conversationId: string;
  intentType: ChatIntentType;
  parameters: Record<string, string>;
  rounds: ClarificationRound[];
  status: "active" | "confirmed" | "skipped" | "expired";
  createdAt: number;
  updatedAt: number;
}
