/**
 * Shared chat utilities for SSE parsing and streaming execution.
 * Extracted from scenario-chat-sheet.tsx to be reused across chat surfaces.
 */

export interface ThinkingStep {
  tool: string;
  label: string;
  skillName?: string;
}

export interface SkillUsed {
  tool: string;
  skillName: string;
}

export interface ChatAttachment {
  fileName: string;
  fileSize: number;
  contentType: string;
  downloadUrl: string;
  objectKey: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  durationMs?: number;
  thinkingSteps?: ThinkingStep[];
  skillsUsed?: SkillUsed[];
  sources?: string[];
  referenceCount?: number;
  kind?: "text" | "mission_card" | "clarification" | "parameter_confirmation";
  missionId?: string;
  templateId?: string;
  templateName?: string;
  hasArtifact?: boolean;
  attachments?: ChatAttachment[];
  senderId?: string;
  senderType?: "human" | "ai_employee" | "system";
  senderName?: string;
  clarificationQuestion?: string;
  clarificationParameters?: Record<string, string>;
  clarificationTotalRequired?: number;
  clarificationCollectedCount?: number;
  parameterLabels?: Record<string, string>;
}

/** SSE event parsed from a text buffer. */
export interface SSEEvent {
  event: string;
  data: string;
}

/** Parse SSE events from a text buffer. Returns parsed events and remaining buffer. */
export function parseSSE(buffer: string): {
  events: SSEEvent[];
  remaining: string;
} {
  const events: SSEEvent[] = [];
  const parts = buffer.split("\n\n");
  const remaining = parts.pop() || ""; // last incomplete chunk

  for (const part of parts) {
    if (!part.trim()) continue;
    let eventType = "";
    let data = "";
    for (const line of part.split("\n")) {
      if (line.startsWith("event: ")) eventType = line.slice(7);
      else if (line.startsWith("data: ")) data = line.slice(6);
    }
    if (eventType && data) {
      events.push({ event: eventType, data });
    }
  }

  return { events, remaining };
}

/** Step switch info from multi-step intent execution. */
export interface StepInfo {
  stepIndex: number;
  totalSteps: number;
  employeeSlug: string;
  employeeName: string;
  taskDescription: string;
}

export interface StepCompleteInfo {
  stepIndex: number;
  employeeSlug: string;
  employeeName: string;
  summary: string;
}

export interface StreamingChatCallbacks {
  onThinking?: (step: ThinkingStep) => void;
  onSkillUsed?: (skill: SkillUsed) => void;
  onSource?: (sources: string[], totalReferences: number) => void;
  onTextDelta?: (text: string, accumulated: string, meta?: { senderId?: string; senderName?: string }) => void;
  onStepStart?: (step: StepInfo) => void;
  onStepComplete?: (step: StepCompleteInfo) => void;
  onDone?: (result: {
    sources: string[];
    referenceCount: number;
    skillsUsed: SkillUsed[];
    finishReason?: string;
  }) => void;
  onError?: (message: string) => void;
  onStepReview?: (review: {
    stepIndex: number;
    totalSteps: number;
    employeeSlug: string;
    employeeName: string;
    taskTitle: string;
    outputPreview: string;
    nextStepDescription: string;
    nextStepEmployee: string;
    intent: unknown;
    priorStepOutput: string;
    isLastStep?: boolean;
    originalTargetSlugs?: string[];
  }) => void;
  onParticipantStart?: (info: { participantId: string; participantName: string }) => void;
  onParticipantEnd?: (info: { participantId: string; summary?: string }) => void;
  onChainProgress?: (info: { current: number; total: number }) => void;
  onParallelMerge?: (info: { results: Array<{ participantId: string; content: string }> }) => void;
  onArbitrationStart?: (info: { arbitratorId: string; arbitratorName: string; participantCount: number }) => void;
  onArbitrationEnd?: (info: { finalContent: string; summary?: string }) => void;
}

/**
 * Execute a streaming chat request and parse SSE events.
 * Works with both /api/chat/stream and /api/scenarios/execute endpoints.
 */
export async function executeStreamingChat(
  url: string,
  body: Record<string, unknown>,
  callbacks: StreamingChatCallbacks
): Promise<{ accumulated: string; durationMs: number }> {
  const startTime = Date.now();
  const thinkingSteps: ThinkingStep[] = [];
  const skillsUsed: SkillUsed[] = [];
  const skillSet = new Set<string>();
  const sources: string[] = [];
  let refCount = 0;
  let accumulated = "";

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (fetchErr) {
    // Network-level failure (server unreachable, connection reset, etc.)
    throw new Error(
      `网络请求失败，请检查网络连接后重试。(${fetchErr instanceof Error ? fetchErr.message : "unknown"})`
    );
  }

  if (!res.ok) {
    const errText = (await res.text()) || `HTTP ${res.status}`;
    throw new Error(errText);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No stream");

  const decoder = new TextDecoder();
  let sseBuffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });

    const { events, remaining } = parseSSE(sseBuffer);
    sseBuffer = remaining;

    for (const evt of events) {
      try {
        const payload = JSON.parse(evt.data);
        if (evt.event === "step-review") {
          // step-review received
        }

        switch (evt.event) {
          case "thinking": {
            const step: ThinkingStep = {
              tool: payload.tool,
              label: payload.label,
              skillName: payload.skillName,
            };
            thinkingSteps.push(step);
            callbacks.onThinking?.(step);
            if (payload.skillName && !skillSet.has(payload.tool)) {
              skillSet.add(payload.tool);
              const skill: SkillUsed = {
                tool: payload.tool,
                skillName: payload.skillName,
              };
              skillsUsed.push(skill);
              callbacks.onSkillUsed?.(skill);
            }
            break;
          }
          case "source": {
            const newSources = payload.sources as string[];
            for (const s of newSources) {
              if (!sources.includes(s)) sources.push(s);
            }
            refCount = payload.totalReferences ?? refCount;
            callbacks.onSource?.([...sources], refCount);
            break;
          }
          case "text-delta": {
            accumulated += payload.text;
            callbacks.onTextDelta?.(payload.text, accumulated, {
              senderId: payload.senderId,
              senderName: payload.senderName,
            });
            break;
          }
          case "step-start": {
            callbacks.onStepStart?.({
              stepIndex: payload.stepIndex,
              totalSteps: payload.totalSteps,
              employeeSlug: payload.employeeSlug,
              employeeName: payload.employeeName,
              taskDescription: payload.taskDescription,
            });
            break;
          }
          case "step-complete": {
            callbacks.onStepComplete?.({
              stepIndex: payload.stepIndex,
              employeeSlug: payload.employeeSlug,
              employeeName: payload.employeeName,
              summary: payload.summary,
            });
            break;
          }
          case "step-review": {
            callbacks.onStepReview?.({
              stepIndex: payload.stepIndex,
              totalSteps: payload.totalSteps,
              employeeSlug: payload.employeeSlug,
              employeeName: payload.employeeName,
              taskTitle: payload.taskTitle,
              outputPreview: payload.outputPreview,
              nextStepDescription: payload.nextStepDescription,
              nextStepEmployee: payload.nextStepEmployee,
              intent: payload.intent,
              priorStepOutput: payload.priorStepOutput,
              originalTargetSlugs: payload.originalTargetSlugs,
            });
            break;
          }
          case "participant-start": {
            callbacks.onParticipantStart?.({
              participantId: payload.participantId,
              participantName: payload.participantName,
            });
            break;
          }
          case "participant-end": {
            callbacks.onParticipantEnd?.({
              participantId: payload.participantId,
              summary: payload.summary,
            });
            break;
          }
          case "chain-progress": {
            callbacks.onChainProgress?.({
              current: payload.current,
              total: payload.total,
            });
            break;
          }
          case "parallel-merge": {
            callbacks.onParallelMerge?.({
              results: payload.results as Array<{ participantId: string; content: string }>,
            });
            break;
          }
          case "arbitration-start": {
            callbacks.onArbitrationStart?.({
              arbitratorId: payload.arbitratorId,
              arbitratorName: payload.arbitratorName,
              participantCount: payload.participantCount,
            });
            break;
          }
          case "arbitration-end": {
            callbacks.onArbitrationEnd?.({
              finalContent: payload.finalContent,
              summary: payload.summary,
            });
            break;
          }
          case "done": {
            refCount = payload.referenceCount ?? refCount;
            const finalSources =
              (payload.sources as string[]) ?? sources;
            if (Array.isArray(payload.skillsUsed)) {
              for (const s of payload.skillsUsed as SkillUsed[]) {
                if (!skillSet.has(s.tool)) {
                  skillSet.add(s.tool);
                  skillsUsed.push(s);
                }
              }
            }
            callbacks.onDone?.({
              sources: finalSources,
              referenceCount: refCount,
              skillsUsed: [...skillsUsed],
              finishReason: payload.finishReason,
            });
            break;
          }
          case "error": {
            const msg = payload.message || "未知错误";
            callbacks.onError?.(msg);
            throw new Error(msg);
          }
        }
      } catch (parseErr) {
        if (
          parseErr instanceof Error &&
          parseErr.message !== "未知错误" &&
          !evt.data.startsWith("{")
        ) {
          continue;
        }
        throw parseErr;
      }
    }
  }

  const durationMs = Date.now() - startTime;
  return { accumulated, durationMs };
}
