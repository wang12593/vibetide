"use client";

import { useState, useCallback, useRef, useEffect, type KeyboardEvent, useTransition } from "react";
import { cn } from "@/lib/utils";
import { useChatStream } from "@/hooks/use-chat-stream";
import { upsertConversationMessages } from "@/app/actions/conversations";
import type { ChatMessage } from "@/lib/chat-utils";
import { EmbeddedChatPanel } from "@/components/home/embedded-chat-panel";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import {
  Mic,
  Paperclip,
  ArrowUp,
  Clock,
  FileText,
  Users,
  BookOpen,
  Workflow,
  Sparkles,
  ChevronDown,
  Crown,
  Plus,
  X,
  Loader2,
  Lock,
} from "lucide-react";
import { getUserSuggestions } from "@/app/actions/user-ai-preferences";
import {
  getUnboundSkills,
  addSkill,
  removeSkill,
  getUnboundKnowledgeBases,
  addKnowledgeBase,
  removeKnowledgeBase,
  getUnboundWorkflows,
  addWorkflowToMulan,
  removeWorkflowFromMulan,
  setMulanEmployeeEnabled,
} from "@/app/actions/mulan-config";
import type { WorkflowTemplateRow } from "@/db/types";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface HomeClientProps {
  mulanDbId: string;
  userName: string;
  disabledEmployeeSlugs: string[];
  recentMissions: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    progress: number | null;
  }>;
  recentConversations: Array<{
    id: string;
    title: string;
    updatedAt: string;
  }>;
  dispatchableEmployees: Array<{
    id: string;
    dbId: string;
    name: string;
    nickname: string;
    status: string;
  }>;
  mulanSkills: Array<{
    id: string;
    name: string;
    category: string;
    bindingType?: string;
  }>;
  mulanKnowledgeBases: Array<{
    id: string;
    name: string;
    documentCount: number;
  }>;
  mulanWorkflows: (WorkflowTemplateRow & { __homepagePinnedAt?: Date | null })[];
}

const HOME_CHAT_STATE_KEY = "home-embedded-chat-state";
const HOME_CHAT_STATE_TTL_MS = 4 * 60 * 60 * 1000;

type ConfigTab = "employees" | "knowledge" | "workflows";
type HistoryTab = "conversations" | "missions";

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  completed: { label: "已完成", color: "text-emerald-500" },
  failed: { label: "失败", color: "text-red-400" },
  executing: { label: "执行中", color: "text-blue-500" },
  planning: { label: "规划中", color: "text-amber-500" },
  consolidating: { label: "汇总中", color: "text-purple-500" },
  queued: { label: "排队中", color: "text-gray-400" },
  cancelled: { label: "已取消", color: "text-gray-400" },
};

export function HomeClient({
  mulanDbId,
  userName,
  disabledEmployeeSlugs: initialDisabledSlugs,
  recentMissions,
  recentConversations,
  dispatchableEmployees,
  mulanSkills: initialSkills,
  mulanKnowledgeBases: initialKBs,
  mulanWorkflows,
}: HomeClientProps) {
  const router = useRouter();
  const [inputValue, setInputValue] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [configExpanded, setConfigExpanded] = useState(false);
  const [configTab, setConfigTab] = useState<ConfigTab>("employees");
  const [historyTab, setHistoryTab] = useState<HistoryTab>("conversations");
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  const [skills, setSkills] = useState(initialSkills);
  const [knowledgeBases, setKnowledgeBases] = useState(initialKBs);
  const prevSkillsRef = useRef(initialSkills);
  const prevKBsRef = useRef(initialKBs);
  if (initialSkills !== prevSkillsRef.current) {
    prevSkillsRef.current = initialSkills;
    setSkills(initialSkills);
  }
  if (initialKBs !== prevKBsRef.current) {
    prevKBsRef.current = initialKBs;
    setKnowledgeBases(initialKBs);
  }
  const [addingSkills, setAddingSkills] = useState(false);
  const [addingKBs, setAddingKBs] = useState(false);
  const [unboundSkills, setUnboundSkills] = useState<Array<{ id: string; name: string }>>([]);
  const [unboundKBs, setUnboundKBs] = useState<Array<{ id: string; name: string; documentCount: number }>>([]);
  const [pendingSkillId, setPendingSkillId] = useState<string | null>(null);
  const [pendingKBId, setPendingKBId] = useState<string | null>(null);
  const [pendingRemoveSkillId, setPendingRemoveSkillId] = useState<string | null>(null);
  const [pendingRemoveKBId, setPendingRemoveKBId] = useState<string | null>(null);
  const [addingWorkflows, setAddingWorkflows] = useState(false);
  const [unboundWorkflows, setUnboundWorkflows] = useState<Array<{ id: string; name: string; stepCount: number }>>([]);
  const [pendingWFId, setPendingWFId] = useState<string | null>(null);
  const [pendingRemoveWFId, setPendingRemoveWFId] = useState<string | null>(null);
  const [mulanWFs, setMulanWFs] = useState(mulanWorkflows);
  const [disabledSlugs, setDisabledSlugs] = useState(initialDisabledSlugs);
  const [pendingToggleSlug, setPendingToggleSlug] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    getUserSuggestions().then(setSuggestions).catch(() => {
      setSuggestions(["帮我追踪今日热点", "写一篇科技评论", "分析最近的舆论趋势"]);
    });
  }, []);

  const chat = useChatStream({ employeeSlug: "leader" });

  const homeConvIdRef = useRef<string | null>(null);
  const homeSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (chat.messages.length === 0 || chat.isStreaming || chat.loading || chat.intentLoading) return;
    if (!chat.messages.some((m) => m.role === "user")) return;
    if (homeSaveTimerRef.current) clearTimeout(homeSaveTimerRef.current);
    homeSaveTimerRef.current = setTimeout(() => {
      const msgs = chat.messages.map((m) => ({
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
      }));
      upsertConversationMessages(
        homeConvIdRef.current ?? null,
        "leader",
        msgs,
      ).then((id) => {
        if (id) homeConvIdRef.current = id;
      }).catch(() => {});
    }, 2000);
    return () => { if (homeSaveTimerRef.current) clearTimeout(homeSaveTimerRef.current); };
  }, [chat.messages, chat.isStreaming, chat.loading, chat.intentLoading]);

  const hydratedRef = useRef(false);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    try {
      const raw = sessionStorage.getItem(HOME_CHAT_STATE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as {
        chatOpen?: boolean;
        messages?: ChatMessage[];
        timestamp?: number;
      };
      if (!data || typeof data.timestamp !== "number") return;
      if (Date.now() - data.timestamp > HOME_CHAT_STATE_TTL_MS) {
        sessionStorage.removeItem(HOME_CHAT_STATE_KEY);
        return;
      }
      if (Array.isArray(data.messages) && data.messages.length > 0) {
        chat.setMessages(data.messages);
      }
      if (data.chatOpen) setChatOpen(true);
    } catch (error) {
      console.error("恢复聊天状态失败:", error);
      try { sessionStorage.removeItem(HOME_CHAT_STATE_KEY); } catch {}
    }
  }, []);

  useEffect(() => {
    if (!chatOpen) return;
    if (chat.isStreaming || chat.loading) return;
    const timer = setTimeout(() => {
      try {
        const last = chat.messages[chat.messages.length - 1];
        const trimmed =
          last && last.role === "assistant" && !last.content
            ? chat.messages.slice(0, -1)
            : chat.messages;
        sessionStorage.setItem(
          HOME_CHAT_STATE_KEY,
          JSON.stringify({ chatOpen, messages: trimmed, timestamp: Date.now() }),
        );
      } catch (error) { console.error("保存聊天状态失败:", error); }
    }, 500);
    return () => clearTimeout(timer);
  }, [chatOpen, chat.messages, chat.isStreaming, chat.loading]);

  const [pendingSend, setPendingSend] = useState<string | null>(null);

  useEffect(() => {
    if (pendingSend && chatOpen) {
      chat.sendMessage(pendingSend);
      setPendingSend(null);
    }
  }, [pendingSend, chatOpen, chat]);

  const handleSubmit = useCallback(() => {
    if (!inputValue.trim()) return;
    const text = inputValue;
    setInputValue("");
    setPendingSend(text);
    setChatOpen(true);
  }, [inputValue]);

  const handleFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const picked = Array.from(files);
    setAttachedFiles((prev) => [...prev, ...picked].slice(0, 9));
    e.target.value = "";
  };

  const removeAttachment = (idx: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleChatSend = useCallback(async () => {
    if ((!chatInput.trim() && attachedFiles.length === 0) || chat.isStreaming) return;

    let uploadedAttachments: Array<{
      fileName: string;
      fileSize: number;
      contentType: string;
      downloadUrl: string;
      objectKey: string;
    }> = [];

    if (attachedFiles.length > 0) {
      try {
        for (const file of attachedFiles) {
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch("/api/chat/upload", {
            method: "POST",
            body: formData,
          });
          if (!res.ok) throw new Error(`上传文件 ${file.name} 失败`);
          const { downloadUrl, fileName, fileSize, contentType } = await res.json();
          uploadedAttachments.push({ fileName, fileSize, contentType, downloadUrl, objectKey: downloadUrl });
        }
      } catch (err) {
        console.error("文件上传失败:", err);
        const parts: string[] = [];
        parts.push(`[附件上传失败] ${attachedFiles.map((f) => f.name).join("、")}`);
        if (chatInput.trim()) parts.push(chatInput.trim());
        chat.sendMessage(parts.join("\n"));
        setChatInput("");
        setAttachedFiles([]);
        if (chatTextareaRef.current) chatTextareaRef.current.style.height = "auto";
        return;
      }
    }

    const parts: string[] = [];
    if (uploadedAttachments.length > 0) {
      parts.push(`[附件] ${uploadedAttachments.map((a) => a.fileName).join("、")}`);
    }
    if (chatInput.trim()) parts.push(chatInput.trim());

    setChatInput("");
    setAttachedFiles([]);
    if (chatTextareaRef.current) chatTextareaRef.current.style.height = "auto";
    chat.sendMessage(parts.join("\n"));
  }, [chatInput, chat, attachedFiles]);

  const handleChatKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleChatSend();
      }
    },
    [handleChatSend],
  );

  const handleCloseChat = useCallback(() => {
    setChatOpen(false);
    setChatInput("");
    chat.clearMessages();
    try { sessionStorage.removeItem(HOME_CHAT_STATE_KEY); } catch (error) { console.error("清除聊天状态失败:", error); }
  }, [chat]);

  const handleLoadUnboundSkills = useCallback(async () => {
    if (addingSkills) { setAddingSkills(false); return; }
    setAddingSkills(true);
    try {
      const result = await getUnboundSkills(mulanDbId);
      setUnboundSkills(result.map((s) => ({ id: s.id, name: s.name })));
    } catch { setAddingSkills(false); }
  }, [addingSkills, mulanDbId]);

  const handleBindSkill = useCallback(async (skillId: string, skillName: string) => {
    setPendingSkillId(skillId);
    try {
      await addSkill(mulanDbId, skillId);
      setSkills((prev) => [...prev, { id: skillId, name: skillName, category: "", bindingType: "extended" }]);
      setUnboundSkills((prev) => prev.filter((s) => s.id !== skillId));
      startTransition(() => { router.refresh(); });
    } catch (error) { console.error("绑定技能失败:", error); }
    setPendingSkillId(null);
  }, [mulanDbId, router]);

  const handleUnbindSkill = useCallback(async (skillId: string, bindingType?: string) => {
    if (bindingType === "core") return;
    setPendingRemoveSkillId(skillId);
    try {
      await removeSkill(mulanDbId, skillId);
      setSkills((prev) => prev.filter((s) => s.id !== skillId));
      startTransition(() => { router.refresh(); });
    } catch (error) { console.error("解绑技能失败:", error); }
    setPendingRemoveSkillId(null);
  }, [mulanDbId, router]);

  const handleLoadUnboundKBs = useCallback(async () => {
    if (addingKBs) { setAddingKBs(false); return; }
    setAddingKBs(true);
    try {
      const result = await getUnboundKnowledgeBases(mulanDbId);
      setUnboundKBs(result.map((kb) => ({ id: kb.id, name: kb.name, documentCount: kb.documentCount })));
    } catch { setAddingKBs(false); }
  }, [addingKBs, mulanDbId]);

  const handleBindKB = useCallback(async (kbId: string, kbName: string, docCount: number) => {
    setPendingKBId(kbId);
    try {
      await addKnowledgeBase(mulanDbId, kbId);
      setKnowledgeBases((prev) => [...prev, { id: kbId, name: kbName, documentCount: docCount }]);
      setUnboundKBs((prev) => prev.filter((kb) => kb.id !== kbId));
      startTransition(() => { router.refresh(); });
    } catch (error) { console.error("绑定知识库失败:", error); }
    setPendingKBId(null);
  }, [mulanDbId, router]);

  const handleUnbindKB = useCallback(async (kbId: string) => {
    setPendingRemoveKBId(kbId);
    try {
      await removeKnowledgeBase(mulanDbId, kbId);
      setKnowledgeBases((prev) => prev.filter((kb) => kb.id !== kbId));
      startTransition(() => { router.refresh(); });
    } catch (err) {
      console.error("操作失败:", err);
      toast.error("操作失败，请重试");
    }
    setPendingRemoveKBId(null);
  }, [mulanDbId, router]);

  const handleLoadUnboundWorkflows = useCallback(async () => {
    if (addingWorkflows) { setAddingWorkflows(false); return; }
    setAddingWorkflows(true);
    try {
      const result = await getUnboundWorkflows();
      setUnboundWorkflows(result);
    } catch { setAddingWorkflows(false); }
  }, [addingWorkflows]);

  const handleBindWorkflow = useCallback(async (wfId: string, wfName: string, stepCount: number) => {
    setPendingWFId(wfId);
    try {
      await addWorkflowToMulan(wfId);
      setMulanWFs((prev) => [...prev, { id: wfId, name: wfName, steps: Array(stepCount).fill({}), ownerEmployeeId: "leader" } as WorkflowTemplateRow & { __homepagePinnedAt?: Date | null }]);
      setUnboundWorkflows((prev) => prev.filter((w) => w.id !== wfId));
      startTransition(() => { router.refresh(); });
    } catch (err) {
      console.error("操作失败:", err);
      toast.error("操作失败，请重试");
    }
    setPendingWFId(null);
  }, [router]);

  const handleUnbindWorkflow = useCallback(async (wfId: string) => {
    setPendingRemoveWFId(wfId);
    try {
      await removeWorkflowFromMulan(wfId);
      setMulanWFs((prev) => prev.filter((w) => w.id !== wfId));
      startTransition(() => { router.refresh(); });
    } catch (error) { console.error("解绑工作流失败:", error); }
    setPendingRemoveWFId(null);
  }, [router]);

  const handleToggleEmployee = useCallback(async (slug: string, enable: boolean) => {
    setPendingToggleSlug(slug);
    try {
      await setMulanEmployeeEnabled(slug, enable);
      setDisabledSlugs((prev) =>
        enable ? prev.filter((s) => s !== slug) : [...prev, slug],
      );
      startTransition(() => { router.refresh(); });
    } catch (err) {
      console.error("操作失败:", err);
      toast.error("操作失败，请重试");
    }
    setPendingToggleSlug(null);
  }, [router]);

  const renderInputBox = (mode: "home" | "chat") => (
    <div className="w-full">
      <div className="gemini-border rounded-2xl bg-white dark:bg-white/[0.06] transition-shadow duration-300 ease-out">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={handleFilesPicked}
        />
        {mode === "chat" && attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-5 pt-3">
            {attachedFiles.map((f, i) => (
              <span
                key={`${f.name}-${i}`}
                className="inline-flex items-center gap-1.5 max-w-[200px] pl-2 pr-1 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[11px] text-blue-700 dark:text-blue-300"
              >
                <Paperclip size={12} className="flex-shrink-0" />
                <span className="truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); removeAttachment(i); }}
                  className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-blue-500/70 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-all bg-transparent cursor-pointer"
                  aria-label="移除附件"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="px-5 pt-4 pb-2">
          <textarea
            ref={chatTextareaRef}
            value={mode === "chat" ? chatInput : inputValue}
            onChange={(e) => mode === "chat" ? setChatInput(e.target.value) : setInputValue(e.target.value)}
            onKeyDown={mode === "chat" ? handleChatKeyDown : (e: KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
            }}
            placeholder="有什么想法？告诉穆兰…"
            rows={mode === "chat" ? 1 : 2}
            className={cn(
              "w-full bg-transparent text-[15px] leading-relaxed",
              "text-foreground placeholder:text-muted-foreground/50",
              "resize-none outline-none",
              mode === "chat" ? "min-h-[36px] max-h-[100px]" : "min-h-[52px] max-h-[160px]",
            )}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              const maxH = mode === "chat" ? 100 : 160;
              target.style.height = `${Math.min(target.scrollHeight, maxH)}px`;
            }}
          />
        </div>

        {mode === "home" && !inputValue && suggestions.length > 0 && (
          <div className="px-5 pb-2 flex flex-wrap gap-1.5">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                className="text-xs px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                onClick={() => { setInputValue(s); chatTextareaRef.current?.focus(); }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between px-4 pb-3 pt-1">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsRecording((p) => !p)}
              className={cn(
                "p-2 rounded-xl transition-all duration-200 bg-transparent",
                isRecording
                  ? "bg-red-500/20 text-red-400"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              )}
            >
              <Mic size={16} />
            </button>
            {mode === "chat" && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setTimeout(() => fileInputRef.current?.click(), 0);
                }}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200 bg-transparent cursor-pointer"
                aria-label="上传文件"
                title="上传文件"
              >
                <Paperclip size={16} />
              </button>
            )}
          </div>
          <button
            onClick={mode === "chat" ? handleChatSend : handleSubmit}
            disabled={mode === "chat" ? (!chatInput.trim() && attachedFiles.length === 0) || chat.isStreaming : !inputValue.trim()}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 bg-transparent",
              (mode === "chat" ? ((chatInput.trim() || attachedFiles.length > 0) && !chat.isStreaming) : inputValue.trim())
                ? "bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-[0_2px_12px_rgba(225,29,72,0.4)] hover:scale-105 cursor-pointer"
                : "bg-muted text-muted-foreground/40 cursor-not-allowed",
            )}
          >
            <ArrowUp size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderConfigSection = () => {
    const tabs: { key: ConfigTab; label: string; icon: React.ReactNode; count: number }[] = [
      { key: "employees", label: "员工", icon: <Users size={13} />, count: dispatchableEmployees.length },
      { key: "knowledge", label: "知识库", icon: <BookOpen size={13} />, count: knowledgeBases.length },
      { key: "workflows", label: "工作流", icon: <Workflow size={13} />, count: mulanWFs.length },
    ];

    return (
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setConfigExpanded((v) => !v)}
          className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-white/40 dark:bg-white/[0.04] hover:bg-white/60 dark:hover:bg-white/[0.08] transition-all duration-200 cursor-pointer backdrop-blur-sm"
        >
          <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            能力配置
          </div>
          <ChevronDown
            size={16}
            className={cn(
              "text-muted-foreground transition-transform duration-300 ease-out",
              configExpanded && "rotate-180",
            )}
          />
        </button>

        <div className={cn(
          "overflow-hidden transition-all duration-300 ease-out",
          configExpanded ? "max-h-[70vh] opacity-100 mt-4" : "max-h-0 opacity-0",
        )}>
          <div className="bg-white/30 dark:bg-white/[0.03] rounded-2xl p-4 backdrop-blur-sm border border-border/20">
            <div className="flex gap-2 p-1.5 rounded-xl bg-muted/40">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setConfigTab(t.key)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer",
                    configTab === t.key
                      ? "bg-white dark:bg-white/10 text-foreground shadow-md shadow-black/5 hover:shadow-lg hover:shadow-black/8"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-white/5",
                  )}
                >
                  {t.icon}
                  {t.label}
                  <span className={cn(
                    "min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-xs font-semibold",
                    configTab === t.key
                      ? "bg-gradient-to-br from-rose-500 to-pink-500 text-white"
                      : "bg-muted text-muted-foreground",
                  )}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4 min-h-[80px]">
              {configTab === "employees" && (
              <div className="space-y-2">
                <div className="grid gap-2">
                  {dispatchableEmployees.map((emp) => {
                    const isDisabled = disabledSlugs.includes(emp.id);
                    const isPending = pendingToggleSlug === emp.id;
                    return (
                      <div
                        key={emp.id}
                        className={cn(
                          "flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200",
                          isDisabled
                            ? "bg-white/30 dark:bg-white/[0.02] opacity-60"
                            : "bg-white/80 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.1] hover:shadow-md",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <EmployeeAvatar employeeId={emp.id} size="md" showStatus={!isDisabled} />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground">{emp.name}</div>
                            <div className="text-xs text-muted-foreground">{emp.nickname}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleEmployee(emp.id, isDisabled)}
                          disabled={isPending}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer",
                            isDisabled
                              ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                              : "bg-red-500/10 text-red-500 hover:bg-red-500/20",
                            isPending && "opacity-50",
                          )}
                        >
                          {isPending ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : isDisabled ? (
                            "启用"
                          ) : (
                            "禁用"
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 pt-2">
                  <a
                    href="/ai-employees/create"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/[0.06] transition-all cursor-pointer"
                  >
                    <Plus size={12} />
                    新建员工
                  </a>
                </div>
              </div>
            )}

            {configTab === "knowledge" && (
              <div className="space-y-2">
                <div className="grid gap-2">
                  {knowledgeBases.length > 0 ? knowledgeBases.map((kb) => {
                    const isRemoving = pendingRemoveKBId === kb.id;
                    return (
                      <div key={kb.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/80 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.1] transition-all duration-200 group">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
                            <BookOpen size={16} className="text-amber-500" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground">{kb.name}</div>
                            <div className="text-xs text-muted-foreground">{kb.documentCount} 篇文档</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnbindKB(kb.id)}
                          disabled={isRemoving}
                          className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all duration-200 cursor-pointer opacity-0 group-hover:opacity-100 disabled:opacity-50"
                        >
                          {isRemoving ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                        </button>
                      </div>
                    );
                  }) : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      <BookOpen size={24} className="mx-auto mb-2 opacity-50" />
                      暂无知识库
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleLoadUnboundKBs}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/[0.06] transition-all cursor-pointer"
                  >
                    <Plus size={12} />
                    {addingKBs ? "收起" : "添加知识库"}
                  </button>
                  <a
                    href="/knowledge-bases"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/[0.06] transition-all cursor-pointer"
                  >
                    <Plus size={12} />
                    新建知识库
                  </a>
                </div>

                {addingKBs && (
                  <div className="space-y-2 p-3 rounded-xl bg-muted/20">
                    {unboundKBs.length > 0 ? unboundKBs.map((kb) => {
                      const isPending = pendingKBId === kb.id;
                      return (
                        <button
                          key={kb.id}
                          onClick={() => handleBindKB(kb.id, kb.name, kb.documentCount)}
                          disabled={isPending}
                          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/80 dark:bg-white/[0.06] hover:bg-amber-500/10 transition-all duration-200 cursor-pointer text-left disabled:opacity-50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                              {isPending ? <Loader2 size={14} className="animate-spin text-amber-500" /> : <Plus size={14} className="text-amber-500" />}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-foreground">{kb.name}</div>
                              <div className="text-xs text-muted-foreground">{kb.documentCount} 篇文档</div>
                            </div>
                          </div>
                        </button>
                      );
                    }) : (
                      <div className="text-center py-4 text-xs text-muted-foreground">
                        所有知识库已绑定
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {configTab === "workflows" && (
              <div className="space-y-2">
                <div className="grid gap-2">
                  {mulanWFs.length > 0 ? mulanWFs.map((wf) => {
                    const isRemoving = pendingRemoveWFId === wf.id;
                    return (
                      <div key={wf.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/80 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.1] transition-all duration-200 group">
                        <a
                          href={`/workflows/${wf.id}/edit`}
                          className="flex items-center gap-3 min-w-0"
                        >
                          <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
                            <Workflow size={16} className="text-indigo-500" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground truncate">{wf.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {Array.isArray(wf.steps) ? wf.steps.length : 0} 个步骤
                            </div>
                          </div>
                        </a>
                        <button
                          onClick={() => handleUnbindWorkflow(wf.id)}
                          disabled={isRemoving}
                          className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all duration-200 cursor-pointer opacity-0 group-hover:opacity-100 disabled:opacity-50 flex-shrink-0"
                        >
                          {isRemoving ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                        </button>
                      </div>
                    );
                  }) : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      <Workflow size={24} className="mx-auto mb-2 opacity-50" />
                      暂无工作流
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleLoadUnboundWorkflows}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/[0.06] transition-all cursor-pointer"
                  >
                    <Plus size={12} />
                    {addingWorkflows ? "收起" : "添加工作流"}
                  </button>
                  <a
                    href="/workflows/new"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/[0.06] transition-all cursor-pointer"
                  >
                    <Plus size={12} />
                    新建工作流
                  </a>
                </div>

                {addingWorkflows && (
                  <div className="space-y-2 p-3 rounded-xl bg-muted/20">
                    {unboundWorkflows.length > 0 ? unboundWorkflows.map((wf) => {
                      const isPending = pendingWFId === wf.id;
                      return (
                        <button
                          key={wf.id}
                          onClick={() => handleBindWorkflow(wf.id, wf.name, wf.stepCount)}
                          disabled={isPending}
                          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/80 dark:bg-white/[0.06] hover:bg-indigo-500/10 transition-all duration-200 cursor-pointer text-left disabled:opacity-50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                              {isPending ? <Loader2 size={14} className="animate-spin text-indigo-500" /> : <Plus size={14} className="text-indigo-500" />}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-foreground">{wf.name}</div>
                              <div className="text-xs text-muted-foreground">{wf.stepCount} 个步骤</div>
                            </div>
                          </div>
                        </button>
                      );
                    }) : (
                      <div className="text-center py-4 text-xs text-muted-foreground">
                        所有工作流已关联
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderHistorySection = () => (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setHistoryExpanded((v) => !v)}
        className="w-full flex items-center justify-between py-2 rounded-lg hover:bg-muted/40 transition-colors cursor-pointer bg-transparent"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
          <Clock size={14} />
          历史记录
        </div>
        <ChevronDown
          size={14}
          className={cn(
            "text-muted-foreground transition-transform duration-200",
            historyExpanded && "rotate-180",
          )}
        />
      </button>

      <div className={cn(
        "overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out",
        historyExpanded ? "max-h-[60vh] opacity-100 mt-3 overflow-y-auto scrollbar-thin pr-1" : "max-h-0 opacity-0",
      )}>
        <div className="flex gap-1 p-1 rounded-xl bg-muted/30 mb-3">
          <button
            onClick={() => setHistoryTab("conversations")}
            className={cn(
              "flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer bg-transparent",
              historyTab === "conversations"
                ? "bg-white dark:bg-white/10 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            对话记录
          </button>
          <button
            onClick={() => setHistoryTab("missions")}
            className={cn(
              "flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer bg-transparent",
              historyTab === "missions"
                ? "bg-white dark:bg-white/10 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            任务记录
          </button>
        </div>

        {historyTab === "conversations" && (
          <div className="space-y-1.5">
            {recentConversations.length > 0 ? recentConversations.map((conv) => (
              <div
                key={conv.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/8 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Crown size={14} className="text-rose-500 flex-shrink-0" />
                  <span className="text-xs font-medium truncate">{conv.title}</span>
                </div>
                <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                  {new Date(conv.updatedAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
                </span>
              </div>
            )) : (
              <span className="text-xs text-muted-foreground">暂无对话记录</span>
            )}
          </div>
        )}

        {historyTab === "missions" && (
          <div className="space-y-1.5">
            {recentMissions.length > 0 ? recentMissions.map((m) => {
              const badge = STATUS_BADGE[m.status] ?? { label: m.status, color: "text-gray-400" };
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/8 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={14} className="text-muted-foreground flex-shrink-0" />
                    <span className="text-xs font-medium truncate">{m.title}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {m.progress != null && m.status !== "completed" && m.status !== "failed" && (
                      <div className="w-12 h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{ width: `${m.progress}%` }}
                        />
                      </div>
                    )}
                    <span className={cn("text-[10px] font-medium", badge.color)}>{badge.label}</span>
                  </div>
                </div>
              );
            }) : (
              <span className="text-xs text-muted-foreground">暂无任务记录</span>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (chatOpen) {
    return (
      <div className="relative h-full flex flex-col overflow-hidden">
        <div className="relative z-10 flex-1 min-h-0 flex justify-center overflow-hidden">
          <div className="w-full max-w-3xl min-h-0 flex flex-col">
            <EmbeddedChatPanel
              activeEmployee="leader"
              chat={chat}
              onClose={handleCloseChat}
              embedded
            />
          </div>
        </div>
        <div className="relative z-10 flex-shrink-0 px-4 pb-4 pt-2 flex justify-center">
          <div className="w-full max-w-3xl">
            {renderInputBox("chat")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      <div className="relative z-10 flex-shrink-0 max-w-3xl mx-auto w-full px-6 pt-[28vh] pb-4">
        <div className="flex items-start mb-6">
          <div className="flex flex-col items-start pt-10 ml-6 mt-8">
            <h1 className="text-3xl font-semibold bg-gradient-to-r from-foreground/80 via-foreground/60 to-muted-foreground bg-clip-text text-transparent">
              Hi！{userName}
            </h1>
            <p className="text-3xl font-semibold bg-gradient-to-r from-foreground/80 via-foreground/60 to-muted-foreground bg-clip-text text-transparent mt-1">
              我是你的专属参谋
            </p>
            <p className="text-sm mt-2 bg-gradient-to-r from-muted-foreground/70 to-muted-foreground/40 bg-clip-text text-transparent">
              快来和我对话吧
            </p>
          </div>
          <div className="flex-shrink-0 h-60 w-auto max-w-[263px] ml-auto mr-4">
            <img
              src="/mu.png"
              alt="穆兰"
              className="h-full w-auto object-contain object-bottom"
            />
          </div>
        </div>

        <div className="mx-auto">{renderInputBox("home")}</div>
      </div>

      <div className="relative z-10 flex-1 min-h-0 max-w-3xl mx-auto w-full px-6 overflow-y-auto scrollbar-thin pb-8">
        {renderConfigSection()}
      </div>
    </div>
  );
}
