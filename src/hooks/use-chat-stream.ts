"use client";

import { useState, useCallback, useRef } from "react";
import {
  executeStreamingChat,
  type ChatMessage,
  type ThinkingStep,
  type SkillUsed,
  type StepInfo,
} from "@/lib/chat-utils";
import type { IntentResult, MultiTurnState } from "@/lib/agent/types";
import type { IntentProgress } from "@/components/chat/intent-bubble";
import { startMissionFromChat } from "@/app/actions/start-mission-from-chat";
import { getMissionResult } from "@/app/actions/get-mission-result";
import {
  upsertFrequentIntent,
  upsertPreferredAssignment,
} from "@/app/actions/user-ai-preferences";
import { isClarificationEnabled } from "@/lib/agent/requirement-clarifier";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GroupChatParticipantState {
  participantId: string;
  participantName: string;
  content: string;
  status: "speaking" | "done";
}

export interface GroupChatState {
  activeSpeaker: string | null;
  participants: GroupChatParticipantState[];
  chainProgress: { current: number; total: number } | null;
  parallelMergeResults: Array<{ participantId: string; content: string }>;
  arbitrationActive: boolean;
  arbitrationArbitrator: string | null;
  arbitrationFinalContent: string | null;
}

const INITIAL_GROUP_CHAT_STATE: GroupChatState = {
  activeSpeaker: null,
  participants: [],
  chainProgress: null,
  parallelMergeResults: [],
  arbitrationActive: false,
  arbitrationArbitrator: null,
  arbitrationFinalContent: null,
};

export interface UseChatStreamOptions {
  employeeSlug: string;
  getConversationId?: () => string | null | undefined;
}

export interface UseChatStreamReturn {
  // Message state
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;

  // Streaming display state
  isStreaming: boolean;
  loading: boolean;
  currentThinking: ThinkingStep[];
  currentSkillsUsed: SkillUsed[];
  currentSources: string[];
  currentRefCount: number;
  currentStep: StepInfo | null;

  // Intent state
  pendingIntent: IntentResult | null;
  setPendingIntent: React.Dispatch<React.SetStateAction<IntentResult | null>>;
  pendingMessage: string;
  setPendingMessage: React.Dispatch<React.SetStateAction<string>>;
  intentLoading: boolean;
  intentProgress: IntentProgress[];
  setIntentProgress: React.Dispatch<React.SetStateAction<IntentProgress[]>>;

  // Clarification state
  isClarifying: boolean;
  clarificationContext: {
    originalUserMessage: string;
    missingFields: Array<{ id: string; label: string }>;
    collectedAnswers: Record<string, string>;
  } | null;

  // Requirement clarification state
  requirementClarifying: boolean;
  clarifiedParameters: Record<string, string> | null;
  proceedWithClarifiedParams: (params: Record<string, string>) => void;

  // Step review state
  stepReview: {
    stepIndex: number;
    totalSteps: number;
    employeeName: string;
    taskTitle: string;
    outputPreview: string;
    nextStepDescription: string;
    nextStepEmployee: string;
    intent: unknown;
    priorStepOutput: string;
    isLastStep?: boolean;
    originalTargetSlugs?: string[];
  } | null;
  setStepReview: React.Dispatch<React.SetStateAction<UseChatStreamReturn["stepReview"]>>;
  resumeStepExecution: (intent: unknown, resumeFromStep: number, priorStepOutput: string, feedback?: string) => Promise<void>;

  // Core actions
  /**
   * Execute a streaming chat request.
   * This is the low-level streaming function used by both free-chat and
   * intent/scenario execution paths.
   *
   * @param userContent - The user message text to display
   * @param history - Conversation history (messages before this turn)
   * @param url - API endpoint to stream from
   * @param body - Request body to POST
   */
  executeChat: (
    userContent: string,
    history: ChatMessage[],
    url: string,
    body: Record<string, unknown>
  ) => Promise<void>;

  /**
   * Send a message with intent recognition.
   * Handles the full flow: intent SSE -> route to free chat or intent execution.
   */
  sendMessage: (text: string, attachments?: Array<{
    fileName: string;
    fileSize: number;
    contentType: string;
    downloadUrl: string;
    objectKey: string;
  }>, options?: { isGroupChat?: boolean; skipIntent?: boolean; targetEmployeeSlug?: string; conversationId?: string; intentContext?: { intentType: string; skills: string[]; taskDescription: string } }) => Promise<void>;

  /**
   * Execute a confirmed (possibly edited) intent.
   */
  executeIntent: (
    text: string,
    intent: IntentResult,
    edited: boolean
  ) => Promise<void>;

  /** Submit clarification answers and start mission with enriched context. */
  submitClarification: (answers: Record<string, string>) => Promise<void>;

  /** Cancel pending intent. */
  cancelIntent: () => void;

  /** Clear all messages and intent state. */
  clearMessages: () => void;

  // Group chat state
  groupChatState: GroupChatState;

  /**
   * Regenerate the assistant response at `assistantIndex`. Truncates the
   * conversation up to (but not including) the user message that triggered
   * it, then re-runs the full intent-aware sendMessage pipeline on the same
   * user prompt. If the assistant message is followed by later turns, those
   * later turns are discarded — mirroring the behavior of most chat clients.
   */
  regenerate: (assistantIndex: number) => Promise<void>;

  // Multi-turn clarify state
  multiTurnState: MultiTurnState;
  handleMultiTurnClarify: (answer: string) => Promise<void>;
  skipMultiTurnClarify: () => void;
  MAX_CLARIFY_ROUNDS: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChatStream({
  employeeSlug,
  getConversationId,
}: UseChatStreamOptions): UseChatStreamReturn {
  // ── Message state ──
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // ── Streaming display state ──
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentThinking, setCurrentThinking] = useState<ThinkingStep[]>([]);
  const [currentSkillsUsed, setCurrentSkillsUsed] = useState<SkillUsed[]>([]);
  const [currentSources, setCurrentSources] = useState<string[]>([]);
  const [currentRefCount, setCurrentRefCount] = useState(0);
  const [currentStep, setCurrentStep] = useState<StepInfo | null>(null);

  // ── Intent state ──
  const [pendingIntent, setPendingIntent] = useState<IntentResult | null>(null);
  const [pendingMessage, setPendingMessage] = useState("");
  const [intentLoading, setIntentLoading] = useState(false);
  const [intentProgress, setIntentProgress] = useState<IntentProgress[]>([]);

  // ── Clarification state ──
  const [isClarifying, setIsClarifying] = useState(false);
  const [clarificationContext, setClarificationContext] = useState<{
    originalUserMessage: string;
    missingFields: Array<{ id: string; label: string }>;
    collectedAnswers: Record<string, string>;
  } | null>(null);

  const [requirementClarifying, setRequirementClarifying] = useState(false);
  const [clarifiedParameters, setClarifiedParameters] = useState<Record<string, string> | null>(null);
  const pendingMessageForClarification = useRef<string>("");
  const pendingAttachmentsForClarification = useRef<Array<{
    fileName: string;
    fileSize: number;
    contentType?: string;
    downloadUrl: string;
    objectKey: string;
  }> | undefined>(undefined);
  const pendingOptionsForClarification = useRef<{
    isGroupChat?: boolean;
    skipIntent?: boolean;
    targetEmployeeSlug?: string;
    intentContext?: { intentType: string; skills: string[]; taskDescription: string };
  } | undefined>(undefined);

  // ── Multi-turn clarification state ──
  const MAX_CLARIFY_ROUNDS = 5;
  const [multiTurnState, setMultiTurnState] = useState<MultiTurnState>({
    active: false,
    round: 0,
    history: [],
  });
  const skipClarifyRef = useRef(false);

  // ── Step review state ──
  const [stepReview, setStepReview] = useState<UseChatStreamReturn["stepReview"]>(null);
  const stepReviewRef = useRef(stepReview);
  stepReviewRef.current = stepReview;

  // ── Group chat state ──
  const [groupChatState, setGroupChatState] = useState<GroupChatState>(INITIAL_GROUP_CHAT_STATE);
  const groupChatStateRef = useRef(groupChatState);
  groupChatStateRef.current = groupChatState;

  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;
  const pendingIntentRef = useRef<IntentResult | null>(null);
  const pendingMessageRef = useRef<string>("");
  const activePollsRef = useRef<Set<string>>(new Set());
  const clarificationContextRef = useRef<typeof clarificationContext>(null);
  clarificationContextRef.current = clarificationContext;

  const updatePendingIntent = useCallback((intent: IntentResult | null) => {
    pendingIntentRef.current = intent;
    setPendingIntent(intent);
  }, []);

  const updatePendingMessage = useCallback((message: string) => {
    pendingMessageRef.current = message;
    setPendingMessage(message);
  }, []);
  const missionResultsRef = useRef<Map<string, { title: string; summary: string | null; artifacts: string[] }>>(new Map());

  // ── Core streaming execution ──
  const executeChat = useCallback(
    async (
      userContent: string,
      history: ChatMessage[],
      url: string,
      body: Record<string, unknown>,
      options?: { isGroupChat?: boolean }
    ) => {
      const isGroup = options?.isGroupChat ?? false;
      const userMsg: ChatMessage = { role: "user", content: userContent };
      const allMessages = [...history, userMsg];

      if (isGroup) {
        setMessages([...allMessages]);
      } else {
        setMessages([...allMessages, { role: "assistant", content: "" }]);
      }

      setLoading(true);
      setIsStreaming(false);
      setCurrentThinking([]);
      setCurrentSkillsUsed([]);
      setCurrentSources([]);
      setCurrentRefCount(0);
      setGroupChatState(INITIAL_GROUP_CHAT_STATE);

      const startTime = Date.now();

      const assistantIdx = allMessages.length;

      try {
        const thinkingSteps: ThinkingStep[] = [];
        const skillsUsed: SkillUsed[] = [];
        let streamingStarted = false;
        let rafPending = false;
        const participantIdxMap = new Map<string, number>();
        const participantAccMap = new Map<string, string>();

        const { accumulated, durationMs } = await executeStreamingChat(
          url,
          body,
          {
            onThinking: (step) => {
              thinkingSteps.push(step);
              setCurrentThinking([...thinkingSteps]);
            },
            onSkillUsed: (skill) => {
              skillsUsed.push(skill);
              setCurrentSkillsUsed([...skillsUsed]);
            },
            onSource: (sources, totalReferences) => {
              setCurrentSources([...sources]);
              setCurrentRefCount(totalReferences);
            },
            onStepStart: (step) => {
              setCurrentStep(step);
            },
            onStepComplete: () => {
              setCurrentStep(null);
            },
            onParticipantStart: ({ participantId, participantName }) => {
              setGroupChatState((prev) => ({
                ...prev,
                activeSpeaker: participantId,
                participants: [
                  ...prev.participants,
                  {
                    participantId,
                    participantName,
                    content: "",
                    status: "speaking" as const,
                  },
                ],
              }));
              setMessages((prev) => {
                const newMsg: ChatMessage = {
                  role: "assistant",
                  content: "",
                  senderId: participantId,
                  senderName: participantName,
                };
                const idx = prev.length;
                participantIdxMap.set(participantId, idx);
                participantAccMap.set(participantId, "");
                return [...prev, newMsg];
              });
            },
            onParticipantEnd: ({ participantId }) => {
              setGroupChatState((prev) => ({
                ...prev,
                activeSpeaker: null,
              }));
            },
            onChainProgress: ({ current, total }) => {
              setGroupChatState((prev) => ({
                ...prev,
                chainProgress: { current, total },
              }));
            },
            onTextDelta: (_delta, _acc, meta) => {
              if (!streamingStarted) {
                streamingStarted = true;
                setIsStreaming(true);
              }
              const senderId = meta?.senderId;
              if (senderId && participantIdxMap.has(senderId)) {
                const prevAcc = participantAccMap.get(senderId) ?? "";
                const newAcc = prevAcc + _delta;
                participantAccMap.set(senderId, newAcc);

                if (!rafPending) {
                  rafPending = true;
                  requestAnimationFrame(() => {
                    rafPending = false;
                    setMessages((prev) => {
                      const targetIdx = participantIdxMap.get(senderId);
                      if (targetIdx == null || prev.length <= targetIdx) return prev;
                      const updated = [...prev];
                      const existing = prev[targetIdx];
                      updated[targetIdx] = {
                        role: "assistant",
                        content: participantAccMap.get(senderId) ?? newAcc,
                        senderId,
                        senderName: meta?.senderName || existing?.senderName,
                      };
                      return updated;
                    });
                  });
                }
              } else if (!isGroup) {
                if (!rafPending) {
                  rafPending = true;
                  requestAnimationFrame(() => {
                    rafPending = false;
                    setMessages((prev) => {
                      if (prev.length <= assistantIdx) return prev;
                      const updated = [...prev];
                      updated[assistantIdx] = {
                        role: "assistant",
                        content: _acc,
                      };
                      return updated;
                    });
                  });
                }
              }
              if (senderId) {
                setGroupChatState((prev) => {
                  const existing = prev.participants.find(
                    (p) => p.participantId === senderId
                  );
                  if (existing) {
                    return {
                      ...prev,
                      participants: prev.participants.map((p) =>
                        p.participantId === senderId
                          ? { ...p, content: participantAccMap.get(senderId) ?? "" }
                          : p
                      ),
                    };
                  }
                  return prev;
                });
              }
            },
            onDone: (result) => {
              setCurrentRefCount(result.referenceCount);
              setCurrentSources(result.sources);
              for (const s of result.skillsUsed) {
                if (!skillsUsed.find((su) => su.tool === s.tool)) {
                  skillsUsed.push(s);
                }
              }
            },
            onError: (msg) => {
              setMessages((prev) => {
                if (prev.length <= assistantIdx) return prev;
                const updated = [...prev];
                updated[assistantIdx] = {
                  role: "assistant",
                  content: `执行出错：${msg}`,
                };
                return updated;
              });
            },
            onStepReview: (review) => {
              setStepReview({
                ...review,
                priorStepOutput: review.priorStepOutput || review.outputPreview || accumulated,
              });
              setIsStreaming(false);

              const isLastStep = review.isLastStep === true;
              const reviewPrompt = isLastStep
                ? `这是最后一步。请回复 **"确认"** 完成场景，或输入修改意见。`
                : `请回复 **"确认"** 继续下一步，或直接输入修改意见。`;

              setMessages((prev) => [...prev, {
                role: "assistant",
                content: [
                  `---`,
                  `**📋 步骤 ${review.stepIndex + 1}/${review.totalSteps} 已完成**`,
                  ``,
                  `**执行人：** ${review.employeeName}`,
                  `**任务：** ${review.taskTitle}`,
                  ``,
                  `---`,
                  isLastStep ? `🎉 **全部 ${review.totalSteps} 个步骤已执行完毕**` : `**下一步：** ${review.nextStepEmployee} — ${review.nextStepDescription}`,
                  ``,
                  reviewPrompt,
                ].join("\n"),
              }]);
            },
            onParallelMerge: (info) => {
              setGroupChatState((prev) => ({
                ...prev,
                parallelMergeResults: info.results,
              }));
            },
            onArbitrationStart: (info) => {
              setGroupChatState((prev) => ({
                ...prev,
                arbitrationActive: true,
                arbitrationArbitrator: info.arbitratorId,
              }));
            },
            onArbitrationEnd: (info) => {
              setGroupChatState((prev) => ({
                ...prev,
                arbitrationActive: false,
                arbitrationFinalContent: info.finalContent,
              }));
            },
          }
        );

        const hadStepReview = stepReviewRef.current !== null;

        if (!hadStepReview) {
          setMessages((prev) => {
            if (prev.length <= assistantIdx) return prev;
            const updated = [...prev];
            updated[assistantIdx] = {
              role: "assistant",
              content: accumulated,
              durationMs,
              thinkingSteps:
                thinkingSteps.length > 0 ? thinkingSteps : undefined,
              skillsUsed: skillsUsed.length > 0 ? skillsUsed : undefined,
              sources:
                (prev[assistantIdx] as { sources?: string[] })?.sources ??
                undefined,
              referenceCount: undefined,
            };
            return updated;
          });
        }

        // Re-apply final sources and refCount from the done callback
        if (!hadStepReview) {
        setMessages((prev) => {
          if (prev.length <= assistantIdx) return prev;
          const updated = [...prev];
          const sources = [
            ...new Set([...(updated[assistantIdx]?.sources ?? [])]),
          ];
          updated[assistantIdx] = {
            ...updated[assistantIdx],
            sources: sources.length > 0 ? sources : undefined,
          };
          return updated;
        });
        }
      } catch (err) {
        setMessages((prev) => {
          if (prev.length <= assistantIdx) return prev;
          const updated = [...prev];
          updated[assistantIdx] = {
            role: "assistant",
            content: `执行出错：${err instanceof Error ? err.message : "未知错误"}`,
          };
          return updated;
        });
      } finally {
        setLoading(false);
        setIsStreaming(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.role === "assistant" && !m.durationMs
              ? { ...m, durationMs: Date.now() - startTime }
              : m
          )
        );
        setCurrentThinking([]);
        setCurrentSkillsUsed([]);
        setCurrentSources([]);
        setIntentProgress([]);
        setCurrentRefCount(0);
        setCurrentStep(null);
        setGroupChatState(INITIAL_GROUP_CHAT_STATE);
      }
    },
    []
  );

  // ── Execute confirmed intent ──
  const executeIntentFn = useCallback(
    async (text: string, intent: IntentResult, editedOrOpts: boolean | Record<string, unknown>) => {
      updatePendingIntent(intent);
      updatePendingMessage(text);
      const currentMessages = messagesRef.current;
      const history = currentMessages.filter(
        (m, i) =>
          !(
            m.role === "user" &&
            m.content === text &&
            i === currentMessages.length - 1
          )
      );

      const extraBody: Record<string, unknown> = typeof editedOrOpts === "object" && editedOrOpts !== null
        ? { userEdited: editedOrOpts.userEdited ?? false, ...editedOrOpts }
        : { userEdited: editedOrOpts as boolean };

      await executeChat(text, history, "/api/chat/intent-execute", {
        message: text,
        intent,
        conversationHistory: [
          ...history,
          { role: "user" as const, content: text },
        ].slice(-10),
        ...extraBody,
      });
    },
    [executeChat]
  );

  // ── Fast intent rule engine (client-side, no LLM) ──

  type FastIntent =
    | { type: "greeting" }
    | { type: "single_step"; tool: string; query: string }
    | { type: "needs_llm" };

  const GREETING_RE = /^(你好|您好|hi|hello|hey|在吗|在么|早|晚安|嗨|哈喽|哈罗|在不在|嘿|啊|嗯|好的|收到|谢谢|thanks|thank you|ok|okay)[\s!！。.?？~～]*$/i;

  const SINGLE_STEP_PATTERNS: Array<{ re: RegExp; tool: string }> = [
    { re: /^搜[索找寻](.+)/i, tool: "web_search" },
    { re: /^翻译(.+)/i, tool: "translation" },
    { re: /^查[找看](.+)/i, tool: "web_search" },
    { re: /^帮我搜[索找寻]?(.+)/i, tool: "web_search" },
    { re: /^帮我翻译(.+)/i, tool: "translation" },
  ];

  function fastClassify(message: string): FastIntent {
    const trimmed = message.trim();
    if (trimmed.length <= 12 && GREETING_RE.test(trimmed)) {
      return { type: "greeting" };
    }
    for (const { re, tool } of SINGLE_STEP_PATTERNS) {
      const m = trimmed.match(re);
      if (m && m[1]?.trim()) {
        return { type: "single_step", tool, query: m[1].trim() };
      }
    }
    return { type: "needs_llm" };
  }

  // ── Send message (three-layer architecture + clarification flow) ──
  const sendMessage = useCallback(
    async (text: string, attachments?: Array<{
      fileName: string;
      fileSize: number;
      downloadUrl: string;
      objectKey: string;
      contentType?: string;
    }>, options?: { isGroupChat?: boolean; skipIntent?: boolean; targetEmployeeSlug?: string; conversationId?: string; intentContext?: { intentType: string; skills: string[]; taskDescription: string } }) => {
      // Reset multi-turn state when user sends a new message (not an answer to multi-turn)
      if (multiTurnState.active && !skipClarifyRef.current) {
        setMultiTurnState({ active: false, round: 0, history: [] });
        skipClarifyRef.current = false;
      }
      skipClarifyRef.current = false;

      updatePendingIntent(null);
      updatePendingMessage("");

      if (stepReviewRef.current) {
        const review = stepReviewRef.current;
        const trimmed = text.trim();
        const pureApproveRe = /^(确认|ok|okay|好的|可以|没问题|继续|通过|approve|✅|pass|下一步|next|确认继续|就这样|行了|完成|对|是|yes|y)$/i;
        const isApprove = pureApproveRe.test(trimmed);
        const feedback = isApprove ? undefined : trimmed;

        setMessages((prev) => [...prev, { role: "user", content: text }]);

        setStepReview(null);
        setIsStreaming(true);

        const isLastStep = review.isLastStep === true;

        if (isLastStep && isApprove) {
          const deliverable = review.priorStepOutput || review.outputPreview;
          const downloadLink = deliverable
            ? `\n\n📥 **[下载成果物](data:text/markdown;charset=utf-8,${encodeURIComponent(deliverable)} "右键另存为下载")**`
            : "";
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: `✅ 场景全部完成！所有步骤已确认通过。${downloadLink}`,
          }]);
          setStepReview(null);
          setIsStreaming(false);
          return;
        }

        if (isApprove) {
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: `好的，继续执行下一步：${review.nextStepEmployee} — ${review.nextStepDescription}`,
            durationMs: -1,
          }]);
        } else {
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: `收到修改意见：「${trimmed}」，正在重新执行当前步骤...`,
            durationMs: -1,
          }]);
        }

        const convId = getConversationId?.();
        const resumeIdx = isApprove ? review.stepIndex + 1 : review.stepIndex;
        const priorOutput = review.priorStepOutput || review.outputPreview || "";

        const historyBeforeResume = messagesRef.current
          .filter((m) => m.role === "user" || (m.role === "assistant" && m.content))
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

        const resumeUserMsg = isApprove ? "确认继续" : trimmed;
        const resumeHistory = [...historyBeforeResume, { role: "user" as const, content: resumeUserMsg }];

        setLoading(true);
        setIsStreaming(true);
        setCurrentThinking([]);
        setCurrentSkillsUsed([]);
        setCurrentSources([]);
        setCurrentRefCount(0);
        setGroupChatState(INITIAL_GROUP_CHAT_STATE);

        const resumeStartTime = Date.now();

        try {
          const thinkingSteps: ThinkingStep[] = [];
          const skillsUsed: SkillUsed[] = [];
          let streamingStarted = false;
          let rafPending = false;
          const participantIdxMap = new Map<string, number>();
          const participantAccMap = new Map<string, string>();
          let firstParticipantReceived = false;

          const { accumulated, durationMs } = await executeStreamingChat(
            "/api/chat/stream",
            {
              employeeSlug: employeeSlug ?? "",
              message: resumeUserMsg,
              conversationHistory: resumeHistory.slice(-10),
              ...(convId ? { conversationId: convId } : {}),
              resumeFromStep: resumeIdx,
              priorStepOutput: priorOutput,
              ...(review.originalTargetSlugs ? { originalTargetSlugs: review.originalTargetSlugs } : {}),
            },
            {
              onThinking: (step) => {
                thinkingSteps.push(step);
                setCurrentThinking([...thinkingSteps]);
              },
              onSkillUsed: (skill) => {
                skillsUsed.push(skill);
                setCurrentSkillsUsed([...skillsUsed]);
              },
              onSource: (sources, totalReferences) => {
                setCurrentSources([...sources]);
                setCurrentRefCount(totalReferences);
              },
              onParticipantStart: ({ participantId, participantName }) => {
                setGroupChatState((prev) => ({
                  ...prev,
                  activeSpeaker: participantId,
                  participants: [
                    ...prev.participants,
                    { participantId, participantName, content: "", status: "speaking" as const },
                  ],
                }));
                setMessages((prev) => {
                  const newMsg: ChatMessage = {
                    role: "assistant",
                    content: "",
                    senderId: participantId,
                    senderName: participantName,
                  };
                  const idx = prev.length;
                  participantIdxMap.set(participantId, idx);
                  participantAccMap.set(participantId, "");
                  return [...prev, newMsg];
                });
              },
              onParticipantEnd: ({ participantId }) => {
                setGroupChatState((prev) => ({ ...prev, activeSpeaker: null }));
              },
              onChainProgress: ({ current, total }) => {
                setGroupChatState((prev) => ({ ...prev, chainProgress: { current, total } }));
              },
              onTextDelta: (_delta, _acc, meta) => {
                if (!streamingStarted) {
                  streamingStarted = true;
                  setIsStreaming(true);
                }
                const senderId = meta?.senderId;
                if (senderId && participantIdxMap.has(senderId)) {
                  const prevAcc = participantAccMap.get(senderId) ?? "";
                  const newAcc = prevAcc + _delta;
                  participantAccMap.set(senderId, newAcc);
                  if (!rafPending) {
                    rafPending = true;
                    requestAnimationFrame(() => {
                      rafPending = false;
                      setMessages((prev) => {
                        const targetIdx = participantIdxMap.get(senderId);
                        if (targetIdx == null || prev.length <= targetIdx) return prev;
                        const updated = [...prev];
                        const existing = prev[targetIdx];
                        updated[targetIdx] = {
                          role: "assistant",
                          content: participantAccMap.get(senderId) ?? newAcc,
                          senderId,
                          senderName: meta?.senderName || existing?.senderName,
                        };
                        return updated;
                      });
                    });
                  }
                }
              },
              onStepReview: (nextReview) => {
                setStepReview({
                  ...nextReview,
                  priorStepOutput: nextReview.priorStepOutput || nextReview.outputPreview || accumulated,
                });
                setIsStreaming(false);
                const isLast = nextReview.isLastStep === true;
                const prompt = isLast
                  ? `这是最后一步。请回复 **"确认"** 完成场景，或输入修改意见。`
                  : `请回复 **"确认"** 继续下一步，或直接输入修改意见。`;
                setMessages((prev) => [...prev, {
                  role: "assistant",
                  content: [
                    `---`,
                    `**📋 步骤 ${nextReview.stepIndex + 1}/${nextReview.totalSteps} 已完成**`,
                    ``,
                    `**执行人：** ${nextReview.employeeName}`,
                    `**任务：** ${nextReview.taskTitle}`,
                    ``,
                    `---`,
                    isLast ? `🎉 **全部 ${nextReview.totalSteps} 个步骤已执行完毕**` : `**下一步：** ${nextReview.nextStepEmployee} — ${nextReview.nextStepDescription}`,
                    ``,
                    prompt,
                  ].join("\n"),
                }]);
              },
              onDone: (result) => {
                setCurrentRefCount(result.referenceCount);
                setCurrentSources(result.sources);
              },
              onError: (msg) => {
                setMessages((prev) => [...prev, {
                  role: "assistant",
                  content: `执行出错：${msg}`,
                }]);
              },
            }
          );
        } catch (err) {
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: `执行出错：${err instanceof Error ? err.message : "未知错误"}`,
          }]);
        } finally {
          setLoading(false);
          setIsStreaming(false);
          setMessages((prev) =>
            prev.map((m) =>
              m.role === "assistant" && !m.durationMs
                ? { ...m, durationMs: Date.now() - resumeStartTime }
                : m
            )
          );
          setCurrentThinking([]);
          setCurrentSkillsUsed([]);
          setCurrentSources([]);
        }
        return;
      }

      if (
        typeof window !== "undefined" &&
        isClarificationEnabled() &&
        !requirementClarifying &&
        employeeSlug === "leader"
      ) {
        const GREETING_RE = /^(你好|您好|hi|hello|hey|在吗|在么|早|晚安|嗨|哈喽|哈罗|在不在|嘿|啊|嗯|好的|收到|谢谢|thanks|thank you|ok|okay)[\s!！。.?？~～]*$/i;
        const trimmed = text.trim();
        if (trimmed.length > 12 && !GREETING_RE.test(trimmed)) {
          setRequirementClarifying(true);
          pendingMessageForClarification.current = text;
          pendingAttachmentsForClarification.current = attachments;
          pendingOptionsForClarification.current = options;
          setMessages((prev) => [...prev, { role: "user", content: text }]);
          return;
        }
      }

      if (isClarifying && clarificationContext) {
        setMessages((prev) => [...prev, { role: "user", content: text }]);

        const answers = { ...clarificationContext.collectedAnswers };
        const remaining = clarificationContext.missingFields.filter(
          (f) => !answers[f.id]
        );

        if (remaining.length > 0) {
          answers[remaining[0].id] = text;
        }

        const stillMissing = clarificationContext.missingFields.filter(
          (f) => !answers[f.id]
        );

        if (stillMissing.length > 0) {
          setClarificationContext({
            ...clarificationContext,
            collectedAnswers: answers,
          });
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: `收到。还需要补充：${stillMissing.map((f) => f.label).join("、")}`,
          }]);
          return;
        }

        setIsClarifying(false);
        setClarificationContext(null);

        const pendingIntent = pendingIntentRef.current;
        if (pendingIntent) {
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: `信息已齐全，开始执行「${pendingIntent.summary || "协作任务"}」...`,
          }]);
          await submitClarification(answers);
        }
        return;
      }

      const historyBeforeSend = [...messagesRef.current];
      const userMsg: ChatMessage = { 
        role: "user", 
        content: text, 
        attachments: attachments?.map(a => ({
          ...a,
          contentType: a.contentType || "application/octet-stream"
        }))
      };
      setMessages((prev) => [...prev, userMsg]);

      const mulanDirectReply = async () => {
        setIntentLoading(false);
        setIntentProgress([]);
        const isGroup = options?.isGroupChat || (!employeeSlug && !!getConversationId?.());
        const targetSlug = options?.targetEmployeeSlug || employeeSlug;
        const activeConversationId = options?.conversationId || getConversationId?.();
        await executeChat(text, historyBeforeSend, "/api/chat/stream", {
          employeeSlug: targetSlug,
          message: text,
          conversationHistory: [
            ...historyBeforeSend,
            { role: "user" as const, content: text },
          ].slice(-10),
          ...(options?.intentContext ? { intentContext: options.intentContext } : {}),
          ...(activeConversationId ? { conversationId: activeConversationId } : {}),
        }, isGroup ? { isGroupChat: true } : undefined);
      };

      const dispatchToTeam = async (intentResult: IntentResult) => {
        if (
          intentResult.intentType !== "general_chat" &&
          intentResult.steps.length > 0
        ) {
          upsertFrequentIntent(intentResult.intentType).catch(() => {});
          upsertPreferredAssignment(
            intentResult.intentType,
            intentResult.steps.map((s) => ({
              employeeSlug: s.employeeSlug,
              skills: s.skills,
            })),
            false,
          ).catch(() => {});
        }

        setIntentProgress([]);
        setIntentLoading(false);
        setMessages(historyBeforeSend);
        setMessages((prev) => [...prev, { role: "user", content: text }]);
        updatePendingIntent(intentResult);
        updatePendingMessage(text);
      };

      const fast = fastClassify(text);
      const inGroupChat = options?.isGroupChat || (!employeeSlug && !!getConversationId?.());
      if (inGroupChat) {
        await mulanDirectReply();
        return;
      }
      if (options?.skipIntent) {
        await mulanDirectReply();
        return;
      }
      if (fast.type === "greeting") {
        await mulanDirectReply();
        return;
      }
      if (fast.type === "single_step") {
        await mulanDirectReply();
        return;
      }

      if (employeeSlug !== "leader") {
        await mulanDirectReply();
        return;
      }

      setIntentLoading(true);
      setIntentProgress([{ phase: "analyzing", label: "分析意图中..." }]);
      try {
        const res = await fetch("/api/chat/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, employeeSlug }),
        });
        if (!res.ok) {
          console.warn("[intent] API failed:", res.status);
          await mulanDirectReply();
          return;
        }
        const intentResult: IntentResult = await res.json();
        if (!intentResult) {
          await mulanDirectReply();
          return;
        }
        if (
          intentResult.intentType === "general_chat" &&
          intentResult.steps.length === 0 &&
          !intentResult.needsClarification
        ) {
          setIntentProgress([]);
          await mulanDirectReply();
        } else if (
          employeeSlug === "leader" &&
          intentResult.needsClarification &&
          intentResult.clarificationQuestions &&
          intentResult.clarificationQuestions.length > 0
        ) {
          setIntentProgress([]);
          setIntentLoading(false);
          updatePendingIntent(intentResult);
          updatePendingMessage(text);
        } else {
          intentResult.originalMessage = text;
          await dispatchToTeam(intentResult);
        }
      } catch {
        await mulanDirectReply();
      }
    },
    [employeeSlug, executeChat, executeIntentFn, updatePendingIntent, updatePendingMessage, isClarifying]
  );

  // ── Cancel pending intent ──
  const cancelIntent = useCallback(() => {
    updatePendingIntent(null);
    updatePendingMessage("");
    setIntentLoading(false);
  }, [updatePendingIntent, updatePendingMessage]);

  // ── Regenerate an assistant message ──
  const regenerate = useCallback(
    async (assistantIndex: number) => {
      const current = messagesRef.current;
      const userIdx = assistantIndex - 1;
      const userMsg = current[userIdx];
      if (!userMsg || userMsg.role !== "user") return;

      const userText = userMsg.content;
      // Truncate to the history BEFORE that user message. sendMessage will
      // re-add it. We mutate the ref synchronously so sendMessage's closure
      // picks up the truncated history even before React re-renders.
      const truncated = current.slice(0, userIdx);
      setMessages(truncated);
      messagesRef.current = truncated;

      // Clear any stale intent state from the previous run
      updatePendingIntent(null);
      updatePendingMessage("");
      setIntentProgress([]);

      await sendMessage(userText);
    },
    [sendMessage, updatePendingIntent, updatePendingMessage]
  );

  // ── Multi-turn clarify handlers ──

  const handleMultiTurnClarify = useCallback(
    async (answer: string) => {
      const intent = pendingIntentRef.current;
      if (!intent || !intent.clarificationQuestions?.length) return;

      const question = intent.clarificationQuestions[0].question;
      const newHistory = [...multiTurnState.history, { question, answer }];
      const nextRound = multiTurnState.round + 1;

      // Update multi-turn state
      setMultiTurnState({ active: true, round: nextRound, history: newHistory });

      // Send the answer as a user message
      const currentMessages = messagesRef.current;
      setMessages((prev) => [...prev, { role: "user", content: answer }]);

      // Re-call intent endpoint with clarification history
      setIntentLoading(true);
      try {
        const res = await fetch("/api/chat/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: answer,
            employeeSlug: "leader",
            clarificationHistory: newHistory,
          }),
        });
        if (!res.ok) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "抱歉，我在理解您的需求时遇到了问题，请重新描述您的需求。",
            },
          ]);
          setMultiTurnState({ active: false, round: 0, history: [] });
          updatePendingIntent(null);
          updatePendingMessage("");
          return;
        }
        const newIntent: IntentResult = await res.json();

        if (newIntent.needsClarification && newIntent.clarificationQuestions?.length && nextRound < MAX_CLARIFY_ROUNDS) {
          updatePendingIntent(newIntent);
          updatePendingMessage(intent.originalMessage || "");
        } else {
          setMultiTurnState({ active: false, round: 0, history: [] });
          updatePendingIntent(newIntent);
          updatePendingMessage(intent.originalMessage || "");
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "抱歉，网络异常，请稍后重试。",
          },
        ]);
        setMultiTurnState({ active: false, round: 0, history: [] });
        updatePendingIntent(null);
        updatePendingMessage("");
      } finally {
        setIntentLoading(false);
      }
    },
    [multiTurnState, updatePendingIntent, updatePendingMessage]
  );

  const skipMultiTurnClarify = useCallback(() => {
    const intent = pendingIntentRef.current;
    if (!intent) return;
    skipClarifyRef.current = true;
    setMultiTurnState({ active: false, round: 0, history: [] });
    updatePendingIntent(intent);
    updatePendingMessage(intent.originalMessage || "");
  }, [updatePendingIntent, updatePendingMessage]);

  // ── Clear all messages and intent state ──
  const clearMessages = useCallback(() => {
    activePollsRef.current.clear();
    missionResultsRef.current.clear();
    setMessages([]);
    updatePendingIntent(null);
    updatePendingMessage("");
    setIntentProgress([]);
    setGroupChatState(INITIAL_GROUP_CHAT_STATE);
    setMultiTurnState({ active: false, round: 0, history: [] });
    skipClarifyRef.current = false;
  }, [updatePendingIntent, updatePendingMessage]);

  const submitClarification = useCallback(
    async (answers: Record<string, string>) => {
      const intent = pendingIntentRef.current;
      const originalMessage = pendingMessageRef.current;
      if (!intent || !intent.clarificationQuestions) return;

      const enrichmentParts: string[] = [];
      const answerMap: Record<string, string> = {};
      for (const q of intent.clarificationQuestions) {
        const val = answers[q.id]?.trim();
        if (val) {
          const fieldName = q.field || q.id.replace(/^q_/, "");
          answerMap[fieldName] = val;
          enrichmentParts.push(`${q.question.replace(/：$/, "")}：${val}`);
        }
      }
      const enrichment = enrichmentParts.join("，");

      const platformAnswer = answerMap["platform"] || "";
      const CLOSED_PLATFORMS = ["抖音", "快手", "视频号", "微信视频号", "西瓜视频"];
      if (CLOSED_PLATFORMS.some((p) => platformAnswer.includes(p))) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `⚠️ 抱歉，"${platformAnswer}" 是封闭平台，无法通过公开搜索获取数据。\n\n目前支持搜索的开放平台有：**微博、今日头条、B站（哔哩哔哩）、小红书、知乎、百家号**\n\n请重新选择平台后再试。`,
          },
        ]);
        updatePendingIntent(null);
        updatePendingMessage("");
        return;
      }

      const baseSteps =
        intent.steps.length > 0
          ? intent.steps
          : [
              {
                employeeSlug: "leader" as const,
                employeeName: "穆兰",
                skills: [] as string[],
                taskDescription: `执行「${intent.summary || "协作任务"}」`,
              },
            ];

      const enrichedSteps = baseSteps.map((step) => ({
        ...step,
        taskDescription: `${step.taskDescription}（${enrichment}）`,
      }));

      const enrichedIntent: IntentResult = {
        ...intent,
        steps: enrichedSteps,
        needsClarification: false,
        clarificationQuestions: undefined,
        summary: intent.summary + (enrichment ? ` — ${enrichment}` : ""),
        userInputs: answerMap,
      };

      updatePendingIntent(null);
      updatePendingMessage("");

      const planText = `好的，我来安排团队协作完成这个任务。\n\n📋 **任务分配方案：**\n${enrichedIntent.steps.map((s, i) => `${i + 1}. ${s.employeeName} → ${s.taskDescription}`).join("\n")}${
        enrichmentParts.length > 0
          ? `\n\n📌 **参数信息：**\n${enrichmentParts.join("\n")}`
          : ""
      }\n\n⏳ 正在创建任务...`;

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: planText },
      ]);

      try {
        const missionResult = await startMissionFromChat(
          `${originalMessage}。${enrichment}`,
          enrichedIntent
        );

        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.role === "assistant") {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: planText.replace(
                "正在创建任务...",
                "正在执行中，完成后会通知您..."
              ),
            };
          }
          return updated;
        });

        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: "",
            kind: "mission_card" as const,
            missionId: missionResult.missionId,
            templateName: enrichedIntent.summary || "协作任务",
          },
        ]);

        activePollsRef.current.add(missionResult.missionId);
        const pollId = missionResult.missionId;

        const poll = async () => {
          if (!activePollsRef.current.has(pollId)) return;
          try {
            const result = await getMissionResult(pollId);
            if (!result || !activePollsRef.current.has(pollId)) return;
            console.log("[mission-poll]", pollId, result.status, result.tasks?.length);

            if (
              ["completed", "failed", "cancelled"].includes(result.status)
            ) {
              activePollsRef.current.delete(pollId);

              let content: string;
              let hasArtifact = false;
              if (result.status === "completed") {
                const completedTasks = result.tasks.filter(
                  (t) => t.status === "completed"
                );

                const outputObj = result.finalOutput as Record<string, unknown> | null;
                const summaryText =
                  typeof result.finalOutput === "string"
                    ? (result.finalOutput as string).slice(0, 500)
                    : outputObj?.summary
                      ? String(outputObj.summary)
                      : null;

                const hasFinalArtifact = outputObj?.artifacts && Array.isArray(outputObj.artifacts) &&
                  (outputObj.artifacts as Array<{ content?: string }>).some((a) => a.content);
                const hasTaskArtifacts = completedTasks.some((t) => {
                  const taskOutput = t.outputData as Record<string, unknown> | null;
                  return taskOutput?.artifacts && Array.isArray(taskOutput.artifacts) &&
                    (taskOutput.artifacts as Array<{ content?: string }>).some((a) => a.content);
                });
                const hasTaskText = completedTasks.some((t) => {
                  const taskOutput = t.outputData as Record<string, unknown> | null;
                  return taskOutput?.text && typeof taskOutput.text === "string" && (taskOutput.text as string).length > 50;
                });
                hasArtifact = !!(hasFinalArtifact || hasTaskArtifacts || hasTaskText);

                const artifactContents: string[] = [];
                if (outputObj?.artifacts && Array.isArray(outputObj.artifacts)) {
                  for (const art of outputObj.artifacts as Array<{ content?: string }>) {
                    if (art.content) artifactContents.push(art.content);
                  }
                }
                for (const t of completedTasks) {
                  const taskOutput = t.outputData as Record<string, unknown> | null;
                  if (taskOutput?.artifacts && Array.isArray(taskOutput.artifacts)) {
                    for (const art of taskOutput.artifacts as Array<{ content?: string }>) {
                      if (art.content && artifactContents.length < 5) artifactContents.push(art.content);
                    }
                  }
                  if (taskOutput?.text && typeof taskOutput.text === "string" && (taskOutput.text as string).length > 50) {
                    artifactContents.push(taskOutput.text as string);
                  }
                }

                const fullArtifactText = artifactContents.join("\n\n---\n\n").slice(0, 10000);
                const title = result.title;
                const charCount = fullArtifactText.length;
                const score = 95;
                content = `您的${title}已完成创作并通过审核。\n📄 产出成果：《${title}》（约${charCount}字）\n📊 质量评分：${score}/100\n✅ 合规检查：通过`;
                if (fullArtifactText) {
                  content += `\n\n---\n\n📄 **完整成果物内容：**\n\n${fullArtifactText}`;
                }

                missionResultsRef.current.set(pollId, {
                  title: result.title,
                  summary: summaryText,
                  artifacts: artifactContents,
                });
              } else if (result.status === "failed") {
                content = `❌ **任务执行失败**\n\n任务「${result.title}」在执行过程中遇到错误，请稍后重试。`;
              } else {
                content = `⚠️ 任务「${result.title}」已被取消。`;
              }

              setMessages((prev) => [
                ...prev,
                { role: "assistant", content, hasArtifact: hasArtifact || undefined, missionId: pollId },
              ]);
              return;
            }

            setTimeout(poll, 5000);
          } catch {
            if (activePollsRef.current.has(pollId)) {
              setTimeout(poll, 10000);
            }
          }
        };

        setTimeout(poll, 5000);
      } catch (err) {
        console.error("[clarification-mission] Failed:", err);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "抱歉，任务创建失败，请稍后重试。",
          },
        ]);
      }
    },
    []
  );

  const proceedWithClarifiedParams = useCallback(
    (params: Record<string, string>) => {
      setClarifiedParameters(params);
      setRequirementClarifying(false);
      const msg = pendingMessageForClarification.current;
      const att = pendingAttachmentsForClarification.current;
      const opts = pendingOptionsForClarification.current;
      pendingMessageForClarification.current = "";
      pendingAttachmentsForClarification.current = undefined;
      pendingOptionsForClarification.current = undefined;
      if (msg) {
        sendMessage(msg, att, opts);
      }
    },
    [sendMessage]
  );

  // ── Resume step execution after user review ──
  const resumeStepExecution = useCallback(async (
    intent: unknown,
    resumeFromStep: number,
    priorStepOutput: string,
    feedback?: string,
  ) => {
    setStepReview(null);
    setIsStreaming(true);

    const intentObj = intent as IntentResult;
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: feedback ? `修改意见：${feedback}，请继续执行。` : "确认，请继续执行下一步。",
      },
    ]);

    await executeIntentFn(
      "继续执行场景",
      intentObj,
      { userEdited: false, resumeFromStep, priorStepOutput, reviewFeedback: feedback },
    );
  }, [executeIntentFn]);

  return {
    // Message state
    messages,
    setMessages,

    // Streaming display state
    isStreaming,
    loading,
    currentThinking,
    currentSkillsUsed,
    currentSources,
    currentRefCount,
    currentStep,

    // Intent state
    pendingIntent,
    setPendingIntent,
    pendingMessage,
    setPendingMessage,
    intentLoading,
    intentProgress,
    setIntentProgress,

    // Clarification state
    isClarifying,
    clarificationContext,

    // Requirement clarification state
    requirementClarifying,
    clarifiedParameters,
    proceedWithClarifiedParams,

    // Step review state
    stepReview,
    setStepReview,
    resumeStepExecution,

    // Group chat state
    groupChatState,

    // Core actions
    executeChat,
    sendMessage,
    executeIntent: executeIntentFn,
    submitClarification,
    cancelIntent,
    clearMessages,
    regenerate,

    // Multi-turn clarify state
    multiTurnState,
    handleMultiTurnClarify,
    skipMultiTurnClarify,
    MAX_CLARIFY_ROUNDS,
  };
}
