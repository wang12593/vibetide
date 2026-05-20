"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { useSearchParams, useRouter } from "next/navigation";
import { EmployeeListPanel } from "./employee-list-panel";
import { ChatPanel } from "./chat-panel";
import type { ChatMessage } from "@/lib/chat-utils";
import {
  saveConversation,
  deleteSavedConversation,
  getLatestConversation,
  upsertConversationMessages,
} from "@/app/actions/conversations";
import { upsertPreferredAssignment, getUserSuggestions } from "@/app/actions/user-ai-preferences";
import { createGroupChat, archiveGroupChat } from "@/app/actions/group-chat";
import type { AIEmployee } from "@/lib/types";
import type { SavedConversationRow, WorkflowTemplateRow } from "@/db/types";
import type { IntentResult } from "@/lib/agent/types";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useClarification } from "@/hooks/use-clarification";
import { WorkflowLaunchDialog } from "@/components/workflows/workflow-launch-dialog";
import { EmployeeSelector } from "@/components/shared/employee-selector";

interface ChatCenterClientProps {
  employees: AIEmployee[];
  savedConversations: SavedConversationRow[];
  scenarioMap: Record<string, WorkflowTemplateRow[]>;
}

export function ChatCenterClient({
  employees,
  savedConversations: initialSavedConversations,
  scenarioMap,
}: ChatCenterClientProps) {
  const searchParams = useSearchParams();

  const FRONT_DESK_SLUG = "leader";

  const initialSlug =
    searchParams.get("employee") ||
    employees.find((e) => e.id === FRONT_DESK_SLUG)?.id ||
    (employees[0]?.id ?? "");

  const [selectedSlug, setSelectedSlug] = useState(initialSlug);
  const autoConvIdRef = useRef<string | null>(null);

  // ── Chat stream hook (manages messages, streaming, and intent state) ──
  const chat = useChatStream({ employeeSlug: selectedSlug, getConversationId: () => autoConvIdRef.current });
  const {
    messages,
    setMessages,
    isStreaming,
    loading,
    currentThinking,
    currentSkillsUsed,
    currentSources,
    currentRefCount,
    currentStep,
    pendingIntent,
    pendingMessage,
    intentLoading,
    intentProgress,
    setIntentProgress,
    executeChat,
    executeIntent: executeIntentFn,
    submitClarification,
    cancelIntent,
    clearMessages,
    regenerate,
    isClarifying,
    clarificationContext,
    groupChatState,
    requirementClarifying,
    clarifiedParameters,
    proceedWithClarifiedParams,
  } = chat;

  const clarification = useClarification();

  const requirementStartedRef = useRef(false);

  useEffect(() => {
    if (!requirementClarifying || requirementStartedRef.current) return;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;
    requirementStartedRef.current = true;
    clarification.startClarification(lastUserMsg.content, autoConvIdRef.current ?? undefined);
  }, [requirementClarifying, messages, clarification.startClarification]);

  useEffect(() => {
    if (!clarification.confirmedParameters || !requirementClarifying) return;
    const params = clarification.confirmedParameters;
    clarification.resetClarification();
    requirementStartedRef.current = false;
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "",
        kind: "parameter_confirmation",
        clarificationParameters: params,
        parameterLabels: {
          topic: "主题",
          angle: "角度",
          platform: "平台",
          style: "风格",
          audience: "受众",
          length: "篇幅",
          tone: "语调",
          format: "格式",
          category: "分类",
          source: "来源",
          keyword: "关键词",
          timeframe: "时间范围",
        },
      },
    ]);
  }, [clarification.confirmedParameters, requirementClarifying, clarification.resetClarification, setMessages]);

  useEffect(() => {
    if (clarification.isClarifying && clarification.clarificationMessages.length > 0) {
      const lastMsg = clarification.clarificationMessages[clarification.clarificationMessages.length - 1];
      if (lastMsg.role === "system") {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.kind === "clarification" && last?.content === lastMsg.content) return prev;
          return [
            ...prev.filter((m) => m.kind !== "clarification"),
            {
              role: "assistant" as const,
              content: lastMsg.content,
              kind: "clarification" as const,
              clarificationQuestion: lastMsg.content,
              clarificationParameters: clarification.session?.parameters ?? {},
              clarificationTotalRequired: 5,
              clarificationCollectedCount: Object.values(clarification.session?.parameters ?? {}).filter(Boolean).length,
            },
          ];
        });
      }
    }
  }, [clarification.clarificationMessages, clarification.isClarifying, clarification.session?.parameters, setMessages]);

  // Persist messages per employee across switches
  const messagesMapRef = useRef<Record<string, ChatMessage[]>>({});
  // Track unread: number of assistant messages user hasn't seen for each employee
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  // Track how many messages user has "seen" per employee
  const seenCountRef = useRef<Record<string, number>>({});

  // Scenarios come from server-side props — instant lookup, no fetch needed
  const scenarios = scenarioMap[selectedSlug] ?? [];
  const [activeScenario, setActiveScenario] =
    useState<WorkflowTemplateRow | null>(null);
  const [viewingSaved, setViewingSaved] =
    useState<SavedConversationRow | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [tab, setTab] = useState<"employees" | "groups" | "saved">("employees");
  const [showGroupCreator, setShowGroupCreator] = useState(false);
  const router = useRouter();
  const [selectedGroupEmployees, setSelectedGroupEmployees] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [launching, setLaunching] = useState<WorkflowTemplateRow | null>(null);
  const [savedConversations, setSavedConversations] = useState(
    initialSavedConversations
  );

  const groupConversations = savedConversations.filter(
    (c) => (c as Record<string, unknown>).isGroup === 1
  );
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Keep messagesMap in sync and mark current employee as fully read
  useEffect(() => {
    if (!selectedSlug || viewingSaved) return;
    if (messages.length > 0) {
      messagesMapRef.current[selectedSlug] = messages;
    }
    // User is viewing this employee — mark all as seen
    const assistantCount = messages.filter((m) => m.role === "assistant" && m.content).length;
    seenCountRef.current[selectedSlug] = assistantCount;
    // Clear unread for current employee
    setUnreadCounts((prev) => {
      if (!prev[selectedSlug]) return prev;
      const next = { ...prev };
      delete next[selectedSlug];
      return next;
    });
  }, [messages, selectedSlug, viewingSaved]);

  // Compute unread for all OTHER employees from their stored messages
  useEffect(() => {
    const newUnread: Record<string, number> = {};
    for (const [slug, msgs] of Object.entries(messagesMapRef.current)) {
      if (slug === selectedSlug) continue;
      const assistantCount = msgs.filter((m) => m.role === "assistant" && m.content).length;
      const seen = seenCountRef.current[slug] ?? 0;
      const diff = assistantCount - seen;
      if (diff > 0) newUnread[slug] = diff;
    }
    setUnreadCounts(newUnread);
  }, [selectedSlug]);

  const autoLoadHandled = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (!selectedSlug || viewingSaved) return;
    if (messages.length > 0) return;
    if (autoLoadHandled.current[selectedSlug]) return;
    if (searchParams.get("task")) return;
    autoLoadHandled.current[selectedSlug] = true;

    getLatestConversation(selectedSlug).then((conv) => {
      if (!conv) return;
      const msgs = (conv.messages as ChatMessage[]) ?? [];
      if (msgs.length === 0) return;
      setMessages(msgs);
      messagesMapRef.current[selectedSlug] = msgs;
      autoConvIdRef.current = conv.id;
      setIsSaved(true);
    }).catch(() => {});
  }, [selectedSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (messages.length === 0) return;
    const isGroupChat = !!autoConvIdRef.current && viewingSaved && (viewingSaved as any).isGroup === 1;
    if (!isGroupChat && (!selectedSlug || viewingSaved)) return;
    if (isStreaming || loading || intentLoading) return;

    const msgs = messages.map((m) => ({
      role: m.role,
      content: m.content,
      durationMs: m.durationMs,
      thinkingSteps: m.thinkingSteps,
      skillsUsed: m.skillsUsed,
      sources: m.sources,
      referenceCount: m.referenceCount,
      kind: m.kind,
      missionId: m.missionId,
      templateId: m.templateId,
      templateName: m.templateName,
      senderId: m.senderId,
      senderName: m.senderName,
    }));

    if (isGroupChat) {
      upsertConversationMessages(
        autoConvIdRef.current,
        "group",
        msgs,
      ).then((id) => {
        if (id) autoConvIdRef.current = id;
      }).catch((err) => {
        console.error("[group-chat] auto-save failed:", err);
      });
    } else {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        upsertConversationMessages(
          autoConvIdRef.current,
          selectedSlug,
          msgs,
        ).then((id) => {
          if (id) {
            autoConvIdRef.current = id;
            setIsSaved(true);
          }
        }).catch(() => {});
      }, 2000);
    }

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [messages, selectedSlug, viewingSaved, isStreaming, loading, intentLoading]);

  const selectedEmployee = employees.find((e) => e.id === selectedSlug) ?? null;

  useEffect(() => {
    getUserSuggestions().then(setSuggestions).catch(() => {
      setSuggestions(["帮我追踪今日热点", "写一篇科技评论", "分析最近的舆论趋势"]);
    });
  }, [selectedSlug]);

  // Lock the entire ancestor chain to fixed viewport height so the chat
  // center can use flex layout without any container overflowing.
  // Chain: sidebar-wrapper(min-h-svh) > SidebarInset(flex-1) > inner-main(flex-1) > div.p-6 > this
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    // Collect all ancestors up to body and patch them
    const patches: { el: HTMLElement; saved: string }[] = [];
    const patch = (target: HTMLElement | null | undefined, styles: Record<string, string>) => {
      if (!target) return;
      patches.push({ el: target, saved: target.style.cssText });
      Object.assign(target.style, styles);
    };

    const wrapper = el.parentElement; // div.relative.z-10.p-6
    const innerMain = wrapper?.parentElement; // main.flex-1.overflow-y-auto
    const sidebarInset = innerMain?.parentElement; // SidebarInset (main)
    const sidebarWrapper = sidebarInset?.parentElement; // sidebar-wrapper div

    // sidebar-wrapper (div.flex.h-svh): already correct, just ensure no overflow
    patch(sidebarWrapper, { overflow: "hidden" });
    // SidebarInset (div.flex-1.flex.flex-col): constrain height
    patch(sidebarInset, { minHeight: "0", overflow: "hidden" });
    // inner-main (main.flex-1): flex container, no scroll, min-h-0 for proper flex sizing
    patch(innerMain, { overflow: "hidden", display: "flex", flexDirection: "column", minHeight: "0" });
    // div.p-6 wrapper: fill remaining space, keep minimal top padding for header clearance
    patch(wrapper, { padding: "1px 0 0 0", flex: "1", minHeight: "0", display: "flex", flexDirection: "column" });

    return () => {
      for (const p of patches) p.el.style.cssText = p.saved;
    };
  }, []);

  // Auto-send task from URL param (e.g., from employee marketplace hot task click)
  const taskParamHandled = useRef(false);
  useEffect(() => {
    const task = searchParams.get("task");
    const groupId = searchParams.get("group");
    if (task && !taskParamHandled.current) {
      taskParamHandled.current = true;
      const delay = groupId ? 800 : 200;
      setTimeout(() => {
        chat.sendMessage(decodeURIComponent(task), undefined, groupId ? { isGroupChat: true } : { skipIntent: true });
        if (groupId) {
          window.history.replaceState(null, "", `/chat?group=${groupId}`);
        } else {
          window.history.replaceState(null, "", `/chat?employee=${selectedSlug}`);
        }
      }, delay);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load saved conversation from URL param (e.g., from /chat/[id] redirect)
  const convParamHandled = useRef(false);
  useEffect(() => {
    const convId = searchParams.get("conversation");
    if (convId && !convParamHandled.current) {
      convParamHandled.current = true;
      const conv = savedConversations.find((c) => c.id === convId);
      if (conv) {
        setViewingSaved(conv);
        if (conv.employeeSlug) setSelectedSlug(conv.employeeSlug);
        setMessages((conv.messages as ChatMessage[]) ?? []);
        setIsSaved(true);
        setTab("saved");
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const groupParamHandled = useRef(false);
  useEffect(() => {
    const groupId = searchParams.get("group");
    if (groupId && !groupParamHandled.current) {
      groupParamHandled.current = true;
      const conv = savedConversations.find((c) => c.id === groupId);
      if (conv) {
        autoConvIdRef.current = conv.id;
        setViewingSaved(conv);
        setMessages((conv.messages as ChatMessage[]) ?? []);
        setIsSaved(true);
        setTab("groups");
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const continueParamHandled = useRef(false);
  useEffect(() => {
    const convId = searchParams.get("continue");
    if (convId && !continueParamHandled.current) {
      continueParamHandled.current = true;
      const conv = savedConversations.find((c) => c.id === convId);
      if (conv) {
        if (conv.employeeSlug) setSelectedSlug(conv.employeeSlug);
        const restored = (conv.messages as ChatMessage[]) ?? [];
        setMessages(restored);
        if (conv.employeeSlug) messagesMapRef.current[conv.employeeSlug] = restored;
        setIsSaved(true);
        setViewingSaved(null);
        setTab("employees");
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Live handoff from the home embedded chat. sessionStorage carries the
  // in-memory snapshot (messages, pendingIntent) so the user instantly sees
  // the same conversation state here — even if they clicked "Expand" while
  // the home panel was still streaming. The active home-side fetch can't be
  // transferred across the page boundary; we prefer showing the snapshot
  // immediately over flashing an empty view.
  const handoffParamHandled = useRef(false);
  useEffect(() => {
    if (searchParams.get("handoff") !== "1" || handoffParamHandled.current) {
      return;
    }
    handoffParamHandled.current = true;

    try {
      const raw = sessionStorage.getItem("home-chat-handoff");
      if (raw) {
        const data = JSON.parse(raw) as {
          employeeSlug?: string;
          messages?: ChatMessage[];
          conversationId?: string | null;
          wasStreaming?: boolean;
          timestamp?: number;
        };
        const fresh =
          data &&
          data.employeeSlug &&
          Array.isArray(data.messages) &&
          typeof data.timestamp === "number" &&
          Date.now() - data.timestamp < 60_000;

        if (fresh) {
          setSelectedSlug(data.employeeSlug!);
          setMessages(data.messages!);
          messagesMapRef.current[data.employeeSlug!] = data.messages!;
          // Already persisted server-side if we have an id — skip duplicate save
          setIsSaved(!!data.conversationId);
          setViewingSaved(null);
          setTab("employees");
          // Note: we intentionally do NOT transfer pendingIntent / intentLoading.
          // The home-side stream owned that state; after handoff the stream is
          // dropped, so a stale intent bubble would render in a "completed"
          // phantom state. Starting fresh is cleaner.
        }
      }
    } catch {
      // Snapshot unparseable or missing — fall through to the bare employee view
    } finally {
      // Single-shot: always remove so a refresh doesn't re-hydrate stale data
      try {
        sessionStorage.removeItem("home-chat-handoff");
      } catch {
        // ignore
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean the handoff/continue flags out of the URL AFTER they've been
  // consumed, so a refresh won't replay the hydration.
  useEffect(() => {
    const hasHandoff = searchParams.get("handoff") === "1";
    const hasContinue = searchParams.get("continue");
    if ((hasHandoff || hasContinue) && selectedSlug) {
      window.history.replaceState(
        null,
        "",
        `/chat?employee=${selectedSlug}`
      );
    }
  }, [selectedSlug, searchParams]);

  // Update URL when slug changes — use history.replaceState to avoid Next.js navigation/scroll
  useEffect(() => {
    if (selectedSlug) {
      const current = searchParams.get("employee");
      if (current !== selectedSlug) {
        window.history.replaceState(null, "", `/chat?employee=${selectedSlug}`);
      }
    }
  }, [selectedSlug, searchParams]);

  /* ── Employee selection ── */
  const handleSelectEmployee = useCallback(
    (slug: string) => {
      if (slug === selectedSlug && !viewingSaved) return;
      // Save current employee's messages
      if (selectedSlug && messages.length > 0 && !viewingSaved) {
        messagesMapRef.current[selectedSlug] = messages;
      }
      // Restore target employee's messages (or empty)
      const restored = messagesMapRef.current[slug] ?? [];
      setMessages(restored);
      setActiveScenario(null);
      setViewingSaved(null);
      setIsSaved(false);
      autoConvIdRef.current = null;
      setSelectedSlug(slug);
      setTab("employees");
      // Clear unread for the target employee
      setUnreadCounts((prev) => {
        if (!prev[slug]) return prev;
        const next = { ...prev };
        delete next[slug];
        return next;
      });
    },
    [selectedSlug, viewingSaved, messages]
  );

  /* ── Saved conversation selection ── */
  const handleSelectSaved = useCallback(
    (conv: SavedConversationRow) => {
      autoConvIdRef.current = conv.id;
      setViewingSaved(conv);
      if (conv.employeeSlug) setSelectedSlug(conv.employeeSlug);
      setMessages(
        (conv.messages as ChatMessage[]) ?? []
      );
      setActiveScenario(null);
      setIsSaved(true);
    },
    []
  );

  /* ── Delete saved conversation ── */
  const handleDeleteSaved = useCallback(
    async (id: string) => {
      try {
        await deleteSavedConversation(id);
        setSavedConversations((prev) => prev.filter((c) => c.id !== id));
        if (viewingSaved?.id === id) {
          setViewingSaved(null);
          setMessages([]);
          setIsSaved(false);
        }
      } catch (error) {
        console.error("删除对话失败:", error);
      }
    },
    [viewingSaved]
  );

  const handleDeleteGroupChat = useCallback(
    async (id: string) => {
      try {
        await archiveGroupChat(id);
        setSavedConversations((prev) => prev.filter((c) => c.id !== id));
        if (viewingSaved?.id === id) {
          setViewingSaved(null);
          setMessages([]);
          setIsSaved(false);
        }
      } catch {
        // silently fail
      }
    },
    [viewingSaved]
  );

  /* ── New chat ── */
  const handleNewChat = useCallback(() => {
    clearMessages();
    setActiveScenario(null);
    setViewingSaved(null);
    setIsSaved(false);
    autoConvIdRef.current = null;
    delete autoLoadHandled.current[selectedSlug];
    delete messagesMapRef.current[selectedSlug];
    setUnreadCounts((prev) => {
      if (!prev[selectedSlug]) return prev;
      const next = { ...prev };
      delete next[selectedSlug];
      return next;
    });
  }, [selectedSlug, clearMessages]);

  /* ── Save conversation ── */
  const handleSave = useCallback(async () => {
    if (!selectedEmployee || messages.length === 0 || isSaved) return;
    try {
      // Generate title from first user message
      const firstUserMsg = messages.find((m) => m.role === "user");
      const title = firstUserMsg
        ? firstUserMsg.content.slice(0, 50) +
          (firstUserMsg.content.length > 50 ? "..." : "")
        : `${selectedEmployee.nickname}对话`;

      const row = await saveConversation({
        employeeSlug: selectedSlug,
        title,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          durationMs: m.durationMs,
          thinkingSteps: m.thinkingSteps,
          skillsUsed: m.skillsUsed,
          sources: m.sources,
          referenceCount: m.referenceCount,
        })),
        scenarioId: activeScenario?.id,
      });

      setIsSaved(true);
      if (row) {
        setSavedConversations((prev) => [row, ...prev]);
      }
    } catch {
      // silently fail
    }
  }, [selectedEmployee, selectedSlug, messages, isSaved, activeScenario]);

  /* ── Select scenario — open WorkflowLaunchDialog ── */
  const handleSelectScenario = useCallback(
    (scenario: WorkflowTemplateRow) => {
      setLaunching(scenario);
    },
    [],
  );

  /* ── Handle intent card confirm ── */
  const handleIntentConfirm = useCallback(
    (editedIntent: IntentResult) => {
      setIsSaved(false);
      if (editedIntent.intentType !== "general_chat" && editedIntent.steps.length > 0) {
        upsertPreferredAssignment(
          editedIntent.intentType,
          editedIntent.steps.map((s) => ({
            employeeSlug: s.employeeSlug,
            skills: s.skills,
          })),
          true,
        ).catch(() => {});
      }
      executeIntentFn(pendingMessage, editedIntent, true);
    },
    [pendingMessage, executeIntentFn]
  );

  /* ── Handle intent cancel → fall back to free chat ── */
  const handleIntentCancel = useCallback(() => {
    cancelIntent();
  }, [cancelIntent]);

  /* ── Send free chat message (with intent recognition) ── */
  const handleSendMessage = useCallback(
    async (
      text: string,
      attachments?: Array<{
        fileName: string;
        fileSize: number;
        contentType: string;
        downloadUrl: string;
        objectKey: string;
      }>,
      options?: { isGroupChat?: boolean; skipIntent?: boolean; targetEmployeeSlug?: string; intentContext?: { intentType: string; skills: string[]; taskDescription: string } }
    ) => {
      if (clarification.isClarifying) {
        setMessages((prev) => [...prev, { role: "user", content: text }]);
        clarification.submitClarificationResponse(text);
        return;
      }
      const isGroupChat = tab === "groups" && !!viewingSaved && !!(viewingSaved as Record<string, unknown>).isGroup;
      if (!selectedEmployee && !isGroupChat) return;
      setIsSaved(false);
      const finalOptions = options || (isGroupChat ? { isGroupChat: true } : { skipIntent: true });
      await chat.sendMessage(text, attachments, finalOptions);
    },
    [selectedEmployee, chat, tab, viewingSaved, clarification.isClarifying, clarification.submitClarificationResponse, setMessages]
  );

  /* ── Cancel inline scenario ── */
  const handleCancelScenario = useCallback(() => {
    // no-op: inline scenario form removed; kept for ChatPanel prop compatibility
  }, []);

  /* ── Regenerate an assistant message ── */
  const handleRegenerate = useCallback(
    async (assistantIndex: number) => {
      // Opening a new generation invalidates the saved snapshot — the user
      // can re-save once the new response lands.
      setIsSaved(false);
      await regenerate(assistantIndex);
    },
    [regenerate]
  );

  return (
    <div ref={rootRef} className="flex flex-1 min-h-0 overflow-hidden">
      {launching && (
        <WorkflowLaunchDialog
          template={launching}
          open={!!launching}
          onOpenChange={(o) => !o && setLaunching(null)}
          onLaunched={({ missionId, template }) => {
            setMessages((prev) => [
              ...prev,
              {
                role: "system",
                content: "",
                kind: "mission_card",
                missionId,
                templateId: template.id,
                templateName: template.name,
              },
            ]);
            setLaunching(null);
          }}
        />
      )}
      {showGroupCreator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-[420px] max-h-[80vh] flex flex-col overflow-hidden border border-gray-200/60 dark:border-gray-700/60">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/60 dark:border-gray-700/60">
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">发起群聊</h3>
              <button
                className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border-0 bg-transparent"
                onClick={() => {
                  setShowGroupCreator(false);
                  setSelectedGroupEmployees([]);
                }}
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">群聊标题</label>
                <Input
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                  placeholder="请输入群聊标题（可选）"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">选择员工</label>
                <EmployeeSelector
                  employees={employees}
                  selectedIds={selectedGroupEmployees}
                  onChange={setSelectedGroupEmployees}
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-200/60 dark:border-gray-700/60 flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border-0 bg-transparent"
                onClick={() => {
                  setShowGroupCreator(false);
                  setSelectedGroupEmployees([]);
                }}
              >
                取消
              </button>
              <button
                className="px-4 py-2 rounded-lg text-sm text-white bg-blue-500 hover:bg-blue-600 transition-all border-0 disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={selectedGroupEmployees.length < 2}
                onClick={async () => {
                  try {
                    const result = await createGroupChat({
                      title: groupTitle,
                      employeeSlugs: selectedGroupEmployees,
                    });
                    setShowGroupCreator(false);
                    setSelectedGroupEmployees([]);
                    setGroupTitle("");
                    setTab("groups");
                    if (result) {
                      autoConvIdRef.current = result.id;
                      const newConv = {
                        id: result.id,
                        employeeSlug: null,
                        title: result.title,
                        messages: [],
                        summary: null,
                        isGroup: 1,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        organizationId: "",
                        userId: "",
                        metadata: { employeeSlugs: selectedGroupEmployees },
                        scenarioId: null,
                        groupMode: null as string | null,
                        leaderEmployeeSlug: null,
                      } as unknown as SavedConversationRow;
                      setSavedConversations((prev) => [newConv, ...prev]);
                      setSelectedSlug("");
                      setViewingSaved(newConv);
                      setMessages([]);
                      setIsSaved(false);
                      setActiveScenario(null);
                    }
                  } catch (err) {
                    console.error("[group-chat] create failed:", err);
                    alert("群聊创建失败: " + (err instanceof Error ? err.message : String(err)));
                  }
                }}
              >
                确认创建
              </button>
            </div>
          </div>
        </div>
      )}
      <EmployeeListPanel
        employees={employees}
        savedConversations={savedConversations}
        groupConversations={groupConversations}
        selectedSlug={selectedSlug}
        activeTab={tab}
        unreadCounts={unreadCounts}
        onSelectEmployee={handleSelectEmployee}
        onSelectSaved={handleSelectSaved}
        onSelectGroup={(conv) => {
          autoConvIdRef.current = conv.id;
          setSelectedSlug("");
          setViewingSaved(conv);
          setMessages((conv.messages as ChatMessage[]) ?? []);
          setIsSaved(false);
          setActiveScenario(null);
          setTab("groups");
        }}
        onTabChange={setTab}
        onDeleteSaved={handleDeleteSaved}
        onDeleteGroupChat={handleDeleteGroupChat}
        onCreateGroup={() => setShowGroupCreator(true)}
      />
      <ChatPanel
        employee={selectedEmployee}
        messages={messages}
        scenarios={scenarios}
        activeScenario={activeScenario}
        viewingSaved={viewingSaved}
        isSaved={isSaved}
        loading={loading}
        onSendMessage={handleSendMessage}
        onSelectScenario={handleSelectScenario}
        onCancelScenario={handleCancelScenario}
        onSave={handleSave}
        onNewChat={handleNewChat}
        onRegenerate={handleRegenerate}
        currentThinking={currentThinking}
        currentSkillsUsed={currentSkillsUsed}
        currentSources={currentSources}
        currentRefCount={currentRefCount}
        pendingIntent={pendingIntent}
        intentLoading={intentLoading}
        intentProgress={intentProgress}
        currentStep={currentStep}
        onIntentConfirm={handleIntentConfirm}
        onIntentCancel={handleIntentCancel}
        onClarificationSubmit={submitClarification}
        isStreaming={isStreaming}
        suggestions={suggestions}
        isClarifying={isClarifying}
        clarificationContext={clarificationContext}
        isGroup={tab === "groups" && !!viewingSaved && !!(viewingSaved as any).isGroup}
        groupChatState={groupChatState}
        conversationId={autoConvIdRef.current}
        onRefresh={() => router.refresh()}
        onClarificationSkip={() => {
          clarification.skipClarification();
          clarification.resetClarification();
          requirementStartedRef.current = false;
          proceedWithClarifiedParams({});
        }}
        onParameterConfirm={() => {
          const paramMsg = [...messages].reverse().find((m) => m.kind === "parameter_confirmation");
          proceedWithClarifiedParams(paramMsg?.clarificationParameters ?? {});
        }}
        onParameterModify={() => {
          clarification.resetClarification();
          requirementStartedRef.current = false;
          proceedWithClarifiedParams({});
        }}
      />
    </div>
  );
}
