"use client";

import React, { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import {
  CollapsibleMessageContent,
  markdownComponents,
  remarkPlugins,
} from "@/app/(dashboard)/employee/[id]/collapsible-markdown";
import ReactMarkdown from "react-markdown";
import {
  Send,
  Sparkles,
  Bookmark,
  BookmarkCheck,
  Plus,
  Loader2,
  Globe,
  CheckCircle2,
  ChevronDown,
  Crosshair,
  LineChart,
  PenLine,
  Eraser,
  BookOpen,
  type LucideIcon,
  Radar,
  Search,
  BarChart3,
  FileText,
  Activity,
  Lightbulb,
  Users,
  CalendarDays,
  Package,
  FolderOpen,
  PenTool,
  Type,
  Film,
  RefreshCw,
  Image as ImageIcon,
  Music,
  CheckCircle,
  Shield,
  TrendingUp,
  RotateCcw,
  Radio,
  Zap,
  Home,
  Paperclip,
  Mic,
  X,
  Download,
  UserPlus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { EMPLOYEE_META, EMPLOYEE_SHORT_DESC, type EmployeeId } from "@/lib/constants";
import { CommandPopover, type CommandItem } from "@/components/shared/command-popover";
import { useCommandTrigger } from "@/hooks/use-command-trigger";
import { addGroupParticipant, removeGroupParticipant } from "@/app/actions/group-chat";
import type { AIEmployee } from "@/lib/types";
import { normalizeFieldOption } from "@/lib/types";
import type { WorkflowTemplateRow } from "@/db/types";
import type { ChatMessage, ThinkingStep, SkillUsed } from "@/lib/chat-utils";
import type { SavedConversationRow } from "@/db/types";
import { cn } from "@/lib/utils";
import {
  IntentAnalyzing,
  IntentResultBubble,
  IntentConfirmCard,
  ClarificationCard,
} from "@/components/chat/intent-bubble";
import { IntentConfirmation } from "@/components/chat/intent-confirmation";
import { EmployeeRecommendSheet } from "@/components/chat/employee-recommend-sheet";
import { needsGroupConfirmation, needsClarification } from "@/lib/agent/types";
import { createGroupChat } from "@/app/actions/group-chat";
import { MessageActions } from "@/components/chat/message-actions";
import { MissionCardMessage } from "@/components/chat/mission-card-message";
import { ClarificationCard as RequirementClarificationCard } from "@/components/chat/clarification-card";
import { ParameterConfirmationCard } from "@/components/chat/parameter-confirmation-card";
import {
  ModelSwitcher,
  DEFAULT_MODEL_ID,
} from "@/components/shared/model-switcher";
import {
  ChainProgress,
  ParallelProgress,
} from "@/components/shared/chain-progress";
import type { GroupChatState } from "@/hooks/use-chat-stream";

const ICON_MAP: Record<string, LucideIcon> = {
  Radar,
  Search,
  BarChart3,
  FileText,
  Activity,
  BookOpen,
  Lightbulb,
  Users,
  CalendarDays,
  Package,
  FolderOpen,
  PenTool,
  Type,
  Film,
  RefreshCw,
  Image: ImageIcon,
  Music,
  CheckCircle,
  Shield,
  TrendingUp,
  RotateCcw,
  Radio,
  Zap,
};

/* ── Context for passing onSendMessage into markdown ── */
const ChatActionContext = createContext<((text: string) => void) | null>(null);

/** Extract plain text from a React node tree */
function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in node) {
    return extractText((node as React.ReactElement<{ children?: React.ReactNode }>).props.children);
  }
  return "";
}

/** Interactive list item — shows action buttons on hover */
function InteractiveLi({ children, ...props }: React.HTMLAttributes<HTMLLIElement>) {
  const onAction = useContext(ChatActionContext);
  const text = extractText(children).trim();
  // Only show actions for substantive items (>8 chars, likely a topic/headline)
  const showActions = text.length > 8;

  return (
    <li {...props} className="group/li relative">
      {children}
      {showActions && onAction && (
        <span className="inline-flex items-center gap-0.5 ml-1.5 opacity-0 group-hover/li:opacity-100 transition-opacity duration-200 align-middle">
          <button
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors border-0 cursor-pointer whitespace-nowrap"
            onClick={() => onAction(`请深度追踪「${text.slice(0, 60)}」`)}
          >
            <Crosshair size={10} />
            追踪
          </button>
          <button
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors border-0 cursor-pointer whitespace-nowrap"
            onClick={() => onAction(`请针对「${text.slice(0, 60)}」进行深度分析`)}
          >
            <LineChart size={10} />
            分析
          </button>
          <button
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors border-0 cursor-pointer whitespace-nowrap"
            onClick={() => onAction(`请围绕「${text.slice(0, 60)}」生成一篇内容`)}
          >
            <PenLine size={10} />
            创作
          </button>
        </span>
      )}
    </li>
  );
}

/** Message action bar — shown at bottom of completed AI messages */
function MessageActionBar({ onAction }: { onAction: (text: string) => void }) {
  return (
    <div className="flex items-center gap-1 mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700/50">
      <button
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-blue-500 transition-all border-0 cursor-pointer"
        onClick={() => onAction("请查看当前有哪些热点内容")}
      >
        <Crosshair size={12} />
        查热点
      </button>
      <button
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-purple-500 transition-all border-0 cursor-pointer"
        onClick={() => onAction("请对以上内容进行数据分析")}
      >
        <LineChart size={12} />
        数据分析
      </button>
      <button
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-emerald-500 transition-all border-0 cursor-pointer"
        onClick={() => onAction("请基于以上内容生成一篇可发布的文章")}
      >
        <PenLine size={12} />
        去创作
      </button>
      <button
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-red-400 transition-all border-0 cursor-pointer ml-auto"
        onClick={() => onAction("请总结以上内容的要点")}
      >
        <Sparkles size={12} />
        总结要点
      </button>
    </div>
  );
}

/* ── Build a rounded-rect SVG path starting from top-center, clockwise ── */
function buildBorderPath(w: number, h: number, r: number): string {
  const i = 0.5;
  const R = Math.min(r, (w - 2 * i) / 2, (h - 2 * i) / 2);
  const x1 = i + R;
  const x2 = w - i - R;
  const y1 = i + R;
  const y2 = h - i - R;
  const cx = w / 2;
  return [
    `M${cx},${i}`,
    `H${x2}`,
    `A${R},${R} 0 0,1 ${w - i},${y1}`,
    `V${y2}`,
    `A${R},${R} 0 0,1 ${x2},${h - i}`,
    `H${x1}`,
    `A${R},${R} 0 0,1 ${i},${y2}`,
    `V${y1}`,
    `A${R},${R} 0 0,1 ${x1},${i}`,
    "Z",
  ].join(" ");
}

interface ChatPanelProps {
  employee: AIEmployee | null;
  messages: ChatMessage[];
  scenarios: WorkflowTemplateRow[];
  activeScenario: WorkflowTemplateRow | null;
  viewingSaved: SavedConversationRow | null;
  isSaved: boolean;
  loading: boolean;
  onSendMessage: (
    text: string,
    attachments?: Array<{
      fileName: string;
      fileSize: number;
      contentType: string;
      downloadUrl: string;
      objectKey: string;
    }>,
    options?: { isGroupChat?: boolean; skipIntent?: boolean; targetEmployeeSlug?: string; conversationId?: string; intentContext?: { intentType: string; skills: string[]; taskDescription: string } }
  ) => void;
  onSelectScenario: (scenario: WorkflowTemplateRow) => void;
  onCancelScenario: () => void;
  onSave: () => void;
  onNewChat: () => void;
  /** Regenerate the assistant response at the given index. */
  onRegenerate?: (assistantIndex: number) => void;
  currentThinking: ThinkingStep[];
  currentSkillsUsed: SkillUsed[];
  currentSources: string[];
  currentRefCount: number;
  isStreaming: boolean;
  suggestions?: string[];
  pendingIntent?: import("@/lib/agent/intent-recognition").IntentResult | null;
  intentLoading?: boolean;
  intentProgress?: import("@/components/chat/intent-bubble").IntentProgress[];
  currentStep?: import("@/lib/chat-utils").StepInfo | null;
  onIntentConfirm?: (intent: import("@/lib/agent/intent-recognition").IntentResult) => void;
  onIntentCancel?: () => void;
  onClarificationSubmit?: (answers: Record<string, string>) => void;
  isClarifying?: boolean;
  clarificationContext?: {
    originalUserMessage: string;
    missingFields: Array<{ id: string; label: string }>;
    collectedAnswers: Record<string, string>;
  } | null;
  isGroup?: boolean;
  groupChatState?: GroupChatState | null;
  conversationId?: string | null;
  onRefresh?: () => void;
  onClarificationSkip?: () => void;
  onClarificationConfirm?: () => void;
  onParameterModify?: (field: string) => void;
  onParameterConfirm?: () => void;
}

const ALL_GROUP_SLUGS = [
  "xiaolei", "xiaoce", "xiaozi", "xiaowen",
  "xiaoshen", "xiaofa", "xiaoshu", "xiaojian",
];

function GroupMemberManager({
  conversationId,
  currentSlugs,
  onRefresh,
  onMemberChange,
}: {
  conversationId: string;
  currentSlugs: string[];
  onRefresh?: () => void;
  onMemberChange?: (count: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [slugs, setSlugs] = useState(currentSlugs);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setSlugs(currentSlugs); }, [currentSlugs]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleAdd = async (slug: string) => {
    setLoading(true);
    try {
      await addGroupParticipant({ conversationId, employeeSlug: slug });
      const next = [...slugs, slug];
      setSlugs(next);
      onMemberChange?.(next.length);
      onRefresh?.();
    } catch {}
    setLoading(false);
  };

  const handleRemove = async (slug: string) => {
    if (slugs.length <= 1) return;
    setLoading(true);
    try {
      await removeGroupParticipant({ conversationId, employeeSlug: slug });
      const next = slugs.filter((s) => s !== slug);
      setSlugs(next);
      onMemberChange?.(next.length);
      onRefresh?.();
    } catch {}
    setLoading(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200/60 dark:border-blue-700/40 transition-colors"
      >
        <UserPlus size={14} />
        <span>管理成员 ({slugs.length})</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 py-2 max-h-80 overflow-y-auto">
          <div className="px-3 py-1.5 text-xs text-gray-400 font-medium">当前成员</div>
          {slugs.map((slug) => {
            const meta = EMPLOYEE_META[slug as EmployeeId];
            return (
              <div key={slug} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <EmployeeAvatar employeeId={slug} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{meta?.nickname ?? slug}</div>
                  <div className="text-[10px] text-gray-400 truncate">{meta?.title ?? ""}</div>
                </div>
                <button
                  onClick={() => handleRemove(slug)}
                  disabled={slugs.length <= 1 || loading}
                  className="p-1 rounded text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 disabled:opacity-30 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
          <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1">
            <div className="px-3 py-1.5 text-xs text-gray-400 font-medium">添加成员</div>
            {ALL_GROUP_SLUGS.filter((s) => !slugs.includes(s)).map((slug) => {
              const meta = EMPLOYEE_META[slug as EmployeeId];
              if (!meta) return null;
              return (
                <button
                  key={slug}
                  onClick={() => handleAdd(slug)}
                  disabled={loading || slugs.length >= 6}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-40 transition-colors text-left"
                >
                  <EmployeeAvatar employeeId={slug} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{meta.nickname}</div>
                    <div className="text-[10px] text-gray-400 truncate">{meta.title}</div>
                  </div>
                  <UserPlus size={12} className="text-blue-500" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function ChatPanel({
  employee,
  messages,
  scenarios,
  activeScenario,
  viewingSaved,
  isSaved,
  loading,
  onSendMessage,
  onSelectScenario,
  onCancelScenario,
  onSave,
  onNewChat,
  onRegenerate,
  currentThinking,
  currentSkillsUsed,
  currentSources,
  currentRefCount,
  isStreaming,
  suggestions,
  pendingIntent,
  intentLoading,
  intentProgress,
  currentStep,
  onIntentConfirm,
  onIntentCancel,
  onClarificationSubmit,
  isClarifying,
  clarificationContext,
  isGroup,
  groupChatState,
  conversationId,
  onRefresh,
  onClarificationSkip,
  onClarificationConfirm,
  onParameterModify,
  onParameterConfirm,
}: ChatPanelProps) {
  const [inputText, setInputText] = useState("");
  const [inputHovered, setInputHovered] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [borderDone, setBorderDone] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [borderSize, setBorderSize] = useState({ w: 0, h: 0 });
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL_ID);
  const [scenariosExpanded, setScenariosExpanded] = useState(false);

  const chatBodyRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGPathElement>(null);
  const borderBoxRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const voiceBaseTextRef = useRef<string>("");

  const meta = employee
    ? EMPLOYEE_META[employee.id as EmployeeId]
    : null;
  const employeeId = employee?.id ?? (isGroup ? ((viewingSaved as any)?.metadata?.employeeSlugs as string[] | undefined)?.[0] ?? "leader" : "leader");
  const [groupTitleOverride, setGroupTitleOverride] = useState<string | null>(null);
  const [recommendSheetOpen, setRecommendSheetOpen] = useState(false);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const displayTitle = isGroup && (groupTitleOverride || viewingSaved?.title)
    ? (groupTitleOverride || viewingSaved?.title)
    : (meta?.name ?? employee?.title ?? "");
  const displaySubtitle = isGroup
    ? ((((viewingSaved as any)?.metadata as Record<string, unknown>)?.employeeSlugs as string[]) ?? [])
        .map((slug) => EMPLOYEE_META[slug as EmployeeId]?.name ?? slug)
        .filter(Boolean)
        .join("、") || "群聊"
    : (employee
    ? EMPLOYEE_SHORT_DESC[employee.id as EmployeeId] ?? ""
    : "");

  const groupAtTrigger = useCommandTrigger({ triggerChar: "@" });
  const groupMemberSlugs: string[] = isGroup
    ? (((viewingSaved as any)?.metadata as Record<string, unknown>)?.employeeSlugs as string[]) ?? []
    : [];
  const groupMemberItems: CommandItem[] = groupMemberSlugs
    .filter((slug) => slug in EMPLOYEE_META)
    .map((slug) => {
      const m = EMPLOYEE_META[slug as EmployeeId];
      const IconComp = m.icon;
      return { id: slug, label: m.name, description: `${m.nickname} · ${m.title}`, icon: <span className="text-sm"><IconComp size={14} /></span> };
    });

  /* ── Border animation logic ── */
  const borderActive = inputHovered || inputFocused;

  const stopAnim = useCallback(() => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = 0;
    }
  }, []);

  useEffect(() => {
    const el = borderBoxRef.current;
    if (!el) return;
    const measure = () =>
      setBorderSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [employee?.id]);

  useEffect(() => {
    if (!borderActive) {
      if (!inputFocused) {
        stopAnim();
        setBorderDone(false);
        if (pathRef.current) pathRef.current.style.strokeDashoffset = "1";
        if (glowRef.current) {
          glowRef.current.style.strokeDashoffset = "0";
          glowRef.current.style.opacity = "0";
        }
      }
      return;
    }
    if (borderDone) return;

    let startTs = 0;
    const duration = 1800;

    function tick(ts: number) {
      if (!startTs) startTs = ts;
      const progress = Math.min((ts - startTs) / duration, 1);
      if (pathRef.current) {
        pathRef.current.style.strokeDashoffset = String(1 - progress);
      }
      if (glowRef.current) {
        if (progress < 1) {
          glowRef.current.style.strokeDashoffset = String(-progress);
          glowRef.current.style.opacity = "1";
        } else {
          glowRef.current.style.opacity = "0";
        }
      }
      if (progress < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        setBorderDone(true);
      }
    }

    animRef.current = requestAnimationFrame(tick);
    return () => stopAnim();
  }, [borderActive, borderDone, inputFocused, stopAnim]);

  /* ── Scroll detection ── */
  useEffect(() => {
    const el = chatBodyRef.current;
    if (!el) return;
    const handleScroll = () => {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollDown(distanceFromBottom > 100);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [employee?.id]);

  /* ── Auto-scroll (use scrollTop to avoid scrollIntoView bubbling to outer containers).
     Double rAF waits for async layout (markdown/code blocks) before measuring scrollHeight. ── */
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = chatBodyRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [
    employee?.id,
    activeScenario?.id,
    viewingSaved,
    messages,
    messages.length,
    loading,
    currentThinking,
    intentLoading,
    intentProgress,
    pendingIntent,
  ]);

  const scrollToBottom = () => {
    const el = chatBodyRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  };

  /* ── Auto-resize textarea ── */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [inputText]);

  /* ── File attachment handlers ── */
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

  /* ── Voice input (Web Speech API) ── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      setVoiceSupported(false);
    }
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const toggleVoiceInput = () => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      setVoiceSupported(false);
      return;
    }
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = "zh-CN";
    rec.continuous = true;
    rec.interimResults = true;
    voiceBaseTextRef.current = inputText ? inputText + (inputText.endsWith(" ") ? "" : " ") : "";
    rec.onstart = () => setIsRecording(true);
    rec.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };
    rec.onerror = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = 0; i < ev.results.length; i++) {
        transcript += ev.results[i][0].transcript;
      }
      setInputText(voiceBaseTextRef.current + transcript);
    };
    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      setIsRecording(false);
    }
  };

  const handleSend = async () => {
    if (loading || (viewingSaved && !isGroup)) return;
    const trimmed = inputText.trim();
    if (!trimmed && attachedFiles.length === 0) return;

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

          uploadedAttachments.push({
            fileName,
            fileSize,
            contentType,
            downloadUrl,
            objectKey: downloadUrl,
          });
        }
      } catch (err) {
        console.error("文件上传失败:", err);
        const parts: string[] = [];
        parts.push(`[附件上传失败] ${attachedFiles.map((f) => f.name).join("、")}`);
        if (trimmed) parts.push(trimmed);
        onSendMessage(parts.join("\n"));
        setInputText("");
        setAttachedFiles([]);
        return;
      }
    }

    const parts: string[] = [];
    if (uploadedAttachments.length > 0) {
      parts.push(`[附件] ${uploadedAttachments.map((a) => a.fileName).join("、")}`);
    }
    if (trimmed) parts.push(trimmed);

    onSendMessage(parts.join("\n"), uploadedAttachments.length > 0 ? uploadedAttachments : undefined);
    setInputText("");
    setAttachedFiles([]);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  /* ── Check if last message is streaming ── */
  const lastMsg = messages[messages.length - 1];
  const isLastMsgStreaming =
    loading &&
    lastMsg?.role === "assistant" &&
    lastMsg.content &&
    !lastMsg.durationMs;

  if (!employee && !isGroup) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto">
            <Sparkles size={24} className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            选择一位数字员工开始对话
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50/30 via-slate-50/60 to-slate-50/40 dark:from-blue-950/10 dark:via-gray-900/50 dark:to-gray-900/30 pointer-events-none" />

      {/* ── Header ── fixed at top of the chat panel; sticky + z-index acts
          as a safety net if any ancestor ever regains scrollability. */}
      <div className="sticky top-0 z-20 flex-shrink-0 flex items-center gap-3 px-6 py-3 border-b border-gray-300/50 dark:border-gray-600/50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
        {isGroup ? (
          <div className="flex -space-x-2">
            {(((viewingSaved as any)?.metadata as Record<string, unknown>)?.employeeSlugs as string[])?.map((slug: string) => (
              <div key={slug} className="ring-2 ring-white dark:ring-gray-900 rounded-full">
                <EmployeeAvatar employeeId={slug} size="sm" />
              </div>
            )) ?? (
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <Users size={20} className="text-gray-500" />
              </div>
            )}
          </div>
        ) : (
          <EmployeeAvatar
            employeeId={employeeId}
            size="md"
            showStatus
            status={employee?.status}
          />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {displayTitle}
          </h2>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate">
            {displaySubtitle}
            {activeScenario && (
              <span className="text-blue-500 dark:text-blue-400 ml-2">
                · {activeScenario.name}
              </span>
            )}
          </p>
        </div>

        {isGroup && viewingSaved && conversationId && (
          <GroupMemberManager
            conversationId={conversationId}
            currentSlugs={(((viewingSaved as any)?.metadata as Record<string, unknown>)?.employeeSlugs as string[]) ?? []}
            onRefresh={onRefresh}
            onMemberChange={(count) => setGroupTitleOverride(`群聊（${count}人）`)}
          />
        )}

        {viewingSaved && !isGroup && (
          <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
            收藏对话 · 只读
          </span>
        )}

        {!viewingSaved && messages.length > 0 && (
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 border-0"
            onClick={(e) => {
              e.preventDefault();
              onSave();
            }}
          >
            {isSaved ? (
              <BookmarkCheck size={15} className="text-blue-500" />
            ) : (
              <Bookmark size={15} />
            )}
            {isSaved ? "已收藏" : "收藏"}
          </button>
        )}

        <Link
          href="/home"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200"
        >
          <Home size={15} />
          首页
        </Link>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 border-0"
          onClick={(e) => {
            e.preventDefault();
            onNewChat();
          }}
        >
          <Plus size={15} />
          新对话
        </button>
      </div>

      {/* Scenario bar removed from here — moved to above input bar */}

      {/* ── Group chat progress indicator ── */}
      {isGroup && groupChatState && groupChatState.activeSpeaker && (
        <div className="flex-shrink-0 px-6 py-2.5 border-b border-gray-200/50 dark:border-gray-700/50 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm space-y-1.5">
          {(() => {
            const gc = groupChatState as any;
            if (gc.chainProgress && !gc.arbitrationActive) {
              const totalSteps = gc.chainProgress.total ?? (gc.participants as any[]).length;
              const completedCount = (gc.participants as any[]).filter((p: any) => p.status === "done").length;
              const steps = Array.from({ length: totalSteps }, (_, i) => {
                const p = (gc.participants as any[])[i];
                return {
                  label: i < completedCount ? "完成" : i === completedCount ? "处理中" : "等待中",
                  employeeName: p?.participantName ?? `步骤 ${i + 1}`,
                  status: i < completedCount ? "done" as const : i === completedCount ? "active" as const : "pending" as const,
                };
              });
              return <ChainProgress steps={steps} />;
            }
            if (gc.arbitrationActive) {
              const tracks = (gc.participants as any[]).map((p: any) => ({
                label: p.content?.slice(0, 30) ?? "",
                employeeName: p.participantName,
                status: p.status === "done" ? "done" as const : "active" as const,
                summary: p.content?.slice(0, 60),
              }));
              return (
                <ParallelProgress
                  tracks={tracks}
                  leaderName={gc.arbitrationArbitrator ?? undefined}
                  leaderStatus={gc.arbitrationFinalContent ? "done" as const : gc.arbitrationActive ? "active" as const : "pending" as const}
                />
              );
            }
            return null;
          })()}
        </div>
      )}

      {/* ── Message list ── */}
      <div ref={chatBodyRef} className="relative flex-1 min-h-0 overflow-y-auto">
        <div className="px-6 py-5 space-y-5">
          {messages.length === 0 && !loading ? (
            /* ── Empty state greeting ── */
            <div className="flex flex-col items-center justify-center py-12">
              <EmployeeAvatar
                employeeId={employeeId}
                size="xl"
                className="mb-4"
              />
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">
                你好，我是{displayTitle}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md">
                {employee?.motto || `${displayTitle}，随时为你服务`}
              </p>

              {/* Scenario suggestions */}
              {!viewingSaved && scenarios.length > 0 && (
                <div className="w-full max-w-2xl space-y-2">
                  <p className="text-xs text-gray-400 mb-2 text-center">
                    试试以下场景，或直接输入你的问题
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {scenarios.slice(0, 6).map((s) => {
                      const Icon = ICON_MAP[s.icon ?? ""] || Sparkles;
                      return (
                        <button
                          key={s.id}
                          className="flex items-start gap-2.5 p-3 rounded-xl bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-gray-800/60 text-left transition-all duration-200 group border-0"
                          onClick={() => onSelectScenario(s)}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{
                              backgroundColor: meta?.bgColor ?? "rgba(59,130,246,0.12)",
                            }}
                          >
                            <Icon
                              size={15}
                              style={{ color: meta?.color ?? "#3b82f6" }}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {s.name}
                            </p>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 line-clamp-2 mt-0.5">
                              {s.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── Messages ── */
            <>
              {messages.map((msg, i) => {
                // mission_card 类消息直接渲染卡片，跳过 MessageBubble 逻辑
                if (msg.kind === "mission_card" && msg.missionId) {
                  return (
                    <MissionCardMessage
                      key={i}
                      missionId={msg.missionId}
                      templateName={msg.templateName ?? "任务"}
                    />
                  );
                }

                if (msg.kind === "clarification") {
                  return (
                    <div key={i} className="flex justify-start px-1">
                      <RequirementClarificationCard
                        question={msg.clarificationQuestion ?? msg.content}
                        parameters={msg.clarificationParameters ?? {}}
                        totalRequired={msg.clarificationTotalRequired ?? 0}
                        collectedCount={msg.clarificationCollectedCount ?? 0}
                        onSkip={() => onClarificationSkip?.()}
                      />
                    </div>
                  );
                }

                if (msg.kind === "parameter_confirmation") {
                  return (
                    <div key={i} className="flex justify-start px-1">
                      <ParameterConfirmationCard
                        parameters={msg.clarificationParameters ?? {}}
                        parameterLabels={msg.parameterLabels ?? {}}
                        onConfirm={() => onParameterConfirm?.()}
                        onModify={(field) => onParameterModify?.(field)}
                      />
                    </div>
                  );
                }

                const groupSenderChanged =
                  isGroup &&
                  msg.role === "assistant" &&
                  i > 0 &&
                  messages[i - 1]?.role === "assistant" &&
                  (msg.senderId ?? employeeId) !== ((messages[i - 1] as any).senderId ?? employeeId);

                // Check if this user message is the last one before the assistant response
                const isLastUserBeforeAssistant =
                  msg.role === "user" &&
                  i < messages.length - 1 &&
                  messages[i + 1]?.role === "assistant";
                // Also handle user message as the very last message (intent analyzing phase)
                const isLastUserMsg =
                  msg.role === "user" && i === messages.length - 1;

                const showIntentHere =
                  (isLastUserBeforeAssistant || isLastUserMsg) &&
                  (intentLoading || pendingIntent);

                return msg.role === "user" ? (
                  <React.Fragment key={i}>
                    <div className="flex justify-end">
                      <div className="max-w-[75%] bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl rounded-tr-sm px-5 py-3 text-sm leading-relaxed shadow-sm shadow-blue-500/20">
                        {msg.content}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {msg.attachments.map((att, ai) => (
                              <a
                                key={ai}
                                href={att.downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={att.fileName}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors cursor-pointer group"
                              >
                                {att.contentType.startsWith("image/") ? (
                                  <ImageIcon size={14} className="text-white/80 flex-shrink-0" />
                                ) : (
                                  <FileText size={14} className="text-white/80 flex-shrink-0" />
                                )}
                                <span className="text-xs font-medium text-white group-hover:underline truncate max-w-[200px]">
                                  {att.fileName}
                                </span>
                                <span className="text-[10px] text-white/60">
                                  {att.fileSize > 1024 * 1024
                                    ? `${(att.fileSize / (1024 * 1024)).toFixed(1)}MB`
                                    : `${(att.fileSize / 1024).toFixed(0)}KB`}
                                </span>
                                <Download size={12} className="text-white/60 flex-shrink-0" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Intent bubbles — after user message, before assistant response */}
                    {showIntentHere && intentLoading && (
                      <IntentAnalyzing steps={intentProgress ?? []} />
                    )}
                    {(() => {
                      if (!showIntentHere || !pendingIntent || intentLoading) return null;
                      if (needsClarification(pendingIntent)) {
                        return (
                          <ClarificationCard
                            intent={pendingIntent}
                            onSubmit={(answers) => onClarificationSubmit?.(answers)}
                            onCancel={() => onIntentCancel?.()}
                            onStayHere={() => {
                              const firstStep = pendingIntent.steps[0];
                              if (!firstStep) return;
                              const userMsg = pendingIntent.originalMessage || firstStep.taskDescription || pendingIntent.summary || "";
                              onIntentCancel?.();
                              setTimeout(() => {
                                onSendMessage(userMsg, undefined, {
                                  skipIntent: true,
                                  targetEmployeeSlug: firstStep.employeeSlug,
                                  intentContext: {
                                    intentType: pendingIntent.intentType,
                                    skills: firstStep.skills || [],
                                    taskDescription: firstStep.taskDescription || userMsg,
                                  },
                                });
                              }, 100);
                            }}
                          />
                        );
                      }
                      if (pendingIntent.workflowId) {
                        return (
                          <div className="flex justify-center">
                            <div className="max-w-md rounded-xl bg-white/70 dark:bg-gray-800/50 border border-gray-200/30 dark:border-gray-700/30 px-4 py-3 shadow-sm">
                              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <Sparkles size={15} className="text-blue-500" />
                                推荐场景：{pendingIntent.workflowName || pendingIntent.summary}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {pendingIntent.reasoning || "这个请求适合用可复用场景来执行。"}
                              </p>
                              <div className="mt-3 flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => onIntentCancel?.()}
                                  className="px-3 py-1.5 text-xs rounded-lg text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-700/50"
                                >
                                  取消
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onIntentConfirm?.(pendingIntent)}
                                  className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                                >
                                  启动场景
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      if (needsGroupConfirmation(pendingIntent.steps)) {
                        return (
                          <IntentConfirmation
                            mode="group"
                            steps={pendingIntent.steps.map((s) => ({
                              employeeSlug: s.employeeSlug,
                              employeeName: s.employeeName,
                              taskDescription: s.taskDescription,
                              skills: s.skills,
                            }))}
                            onConfirm={async ({ confirmedSteps }) => {
                              const slugs = confirmedSteps.map((s) => s.employeeSlug);
                              const { id } = await createGroupChat({
                                title: pendingIntent.summary || "协作任务",
                                employeeSlugs: slugs,
                                mode: "serial",
                                leaderEmployeeSlug: "leader",
                              });
                              const userMsg = pendingIntent.originalMessage || pendingIntent.summary || "协作任务";
                              onIntentCancel?.();
                              setTimeout(() => {
                                onSendMessage(userMsg, undefined, {
                                  skipIntent: true,
                                  isGroupChat: true,
                                  conversationId: id,
                                });
                              }, 100);
                            }}
                            onCancel={() => onIntentCancel?.()}
                            onStayHere={() => {
                              const firstStep = pendingIntent.steps[0];
                              if (!firstStep) return;
                              const userMsg = pendingIntent.originalMessage || firstStep.taskDescription || pendingIntent.summary || "";
                              onIntentCancel?.();
                              setTimeout(() => {
                                onSendMessage(userMsg, undefined, {
                                  skipIntent: true,
                                  targetEmployeeSlug: firstStep.employeeSlug,
                                  intentContext: {
                                    intentType: pendingIntent.intentType,
                                    skills: firstStep.skills || [],
                                    taskDescription: firstStep.taskDescription || userMsg,
                                  },
                                });
                              }, 100);
                            }}
                          />
                        );
                      }
                      if (pendingIntent.steps.length === 1) {
                        const step = pendingIntent.steps[0];
                        const empMeta = EMPLOYEE_META[step.employeeSlug as EmployeeId];
                        return (
                          <div className="flex justify-center">
                            <button
                              onClick={() => setRecommendSheetOpen(true)}
                              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/60 dark:bg-gray-800/40 hover:bg-white/80 dark:hover:bg-gray-800/60 transition-all border border-gray-200/30 dark:border-gray-700/30"
                            >
                              <EmployeeAvatar employeeId={step.employeeSlug} size="sm" />
                              <div className="text-left">
                                <div className="text-sm font-medium text-foreground">{empMeta?.name || step.employeeName}</div>
                                <div className="text-xs text-muted-foreground">{step.taskDescription}</div>
                              </div>
                              <span className="text-xs text-blue-500 ml-2">开始对话 →</span>
                            </button>
                            <EmployeeRecommendSheet
                              open={recommendSheetOpen}
                              onOpenChange={setRecommendSheetOpen}
                              employee={{
                                slug: step.employeeSlug,
                                name: empMeta?.name || step.employeeName,
                                title: empMeta?.title || "",
                                skills: step.skills,
                              }}
                              taskUnderstanding={{
                                topic: pendingIntent.summary || "",
                                type: empMeta?.title || step.taskDescription,
                                description: step.taskDescription,
                              }}
                              suggestions={[
                                `"重点聚焦${pendingIntent.summary || '主题'}的核心要点"`,
                                `"结合最新数据和案例"`,
                              ]}
                              loading={recommendLoading}
                              onStartChat={async () => {
                                setRecommendLoading(true);
                                try {
                                  const userMsg = pendingIntent.originalMessage || step.taskDescription || pendingIntent.summary || "开始对话";
                                  setRecommendSheetOpen(false);
                                  onIntentCancel?.();
                                  setTimeout(() => {
                                    onSendMessage(userMsg, undefined, {
                                      skipIntent: true,
                                      targetEmployeeSlug: step.employeeSlug,
                                      intentContext: {
                                        intentType: pendingIntent.intentType,
                                        skills: [],
                                        taskDescription: step.taskDescription || userMsg,
                                      },
                                    });
                                  }, 100);
                                } catch {}
                                setRecommendLoading(false);
                              }}
                            />
                          </div>
                        );
                      }
                      if (pendingIntent.confidence < 0.8 && !loading && !isStreaming && isLastUserMsg) {
                        return (
                          <IntentConfirmCard
                            intent={pendingIntent}
                            onConfirm={(edited) => onIntentConfirm?.(edited)}
                            onCancel={() => onIntentCancel?.()}
                          />
                        );
                      }
                      return (
                        <IntentResultBubble
                          intent={pendingIntent}
                          executing={loading || isStreaming}
                          currentStep={currentStep}
                          onCancel={() => onIntentCancel?.()}
                        />
                      );
                    })()}
                  </React.Fragment>
                ) : !msg.content && !msg.durationMs ? null : (
                  <div key={i} className={cn("flex gap-3", groupSenderChanged && "mt-4 pt-3 border-t border-gray-100 dark:border-gray-800/60")}>
                    {isGroup && msg.senderId ? (
                      <EmployeeAvatar
                        employeeId={msg.senderId}
                        size="sm"
                        className="mt-0.5 flex-shrink-0"
                      />
                    ) : isGroup ? (
                      <div className="w-8 h-8 mt-0.5 flex-shrink-0 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                        <Users size={14} className="text-gray-400" />
                      </div>
                    ) : (
                      <EmployeeAvatar
                        employeeId={employeeId}
                        size="sm"
                        className="mt-0.5 flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      {isGroup && msg.senderName && (
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{msg.senderName}</span>
                          {msg.durationMs && msg.durationMs > 0 && (
                            <span className="text-[10px] text-gray-400">
                              耗时 {(msg.durationMs / 1000).toFixed(1)}s
                            </span>
                          )}
                        </div>
                      )}
                      {!msg.senderId && isGroup ? (
                        <div className="px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-600 dark:text-gray-300">
                          <CollapsibleMessageContent
                            markdown={msg.content}
                            streaming={Boolean(!msg.durationMs && isLastMsgStreaming && i === messages.length - 1)}
                          />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            {msg.durationMs ? (
                              <CheckCircle2 size={14} className="text-blue-500" />
                            ) : (
                              <Loader2 size={14} className="animate-spin text-blue-500" />
                            )}
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                              {msg.durationMs
                                ? `${isGroup && msg.senderName ? msg.senderName : displayTitle}思考完成`
                                : `${isGroup && msg.senderName ? msg.senderName : displayTitle}正在输出...`}
                            </span>
                            {msg.durationMs &&
                              msg.referenceCount != null &&
                              msg.referenceCount > 0 && (
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                  <BookOpen size={12} />
                                  引用{msg.referenceCount}篇资料作为参考
                                </span>
                              )}
                            {msg.durationMs && msg.durationMs > 0 && (
                              <span className="text-[11px] text-gray-400">
                                耗时 {(msg.durationMs / 1000).toFixed(1)}s
                              </span>
                            )}
                          </div>

                          {/* Skills used */}
                          {(() => {
                            const skills = msg.durationMs
                              ? msg.skillsUsed
                              : i === messages.length - 1
                                ? currentSkillsUsed
                                : undefined;
                            return skills && skills.length > 0 ? (
                              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                                <span className="text-[11px] text-gray-400 mr-0.5">
                                  使用技能
                                </span>
                                {skills.map((s) => (
                                  <span
                                    key={s.tool}
                                    className={cn(
                                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/30 text-[11px] text-violet-600 dark:text-violet-400",
                                      !msg.durationMs &&
                                        "animate-in fade-in zoom-in-95 duration-200"
                                    )}
                                  >
                                    <Sparkles size={10} />
                                    {s.skillName}
                                  </span>
                                ))}
                              </div>
                            ) : null;
                          })()}

                          {/* Source tags */}
                          {msg.durationMs &&
                            msg.sources &&
                            msg.sources.length > 0 && (
                              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                                {msg.sources.slice(0, 6).map((src) => (
                                  <span
                                    key={src}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[11px] text-blue-600 dark:text-blue-400"
                                  >
                                    <Globe size={10} />
                                    {src}
                                  </span>
                                ))}
                                {msg.sources.length > 6 && (
                                  <span className="text-[11px] text-gray-400">
                                    +{msg.sources.length - 6}个来源
                                  </span>
                                )}
                              </div>
                            )}

                          {/* Message content */}
                          {msg.content && (
                            <ChatActionContext.Provider value={onSendMessage}>
                              <div className="bg-gradient-to-br from-white/80 to-gray-50/70 dark:from-gray-800/60 dark:to-gray-800/40 backdrop-blur-sm rounded-2xl shadow-[0_1px_6px_rgba(0,0,0,0.06)] ring-1 ring-gray-200/30 dark:ring-gray-700/30">
                                <div className="px-5 py-4">
                                  <CollapsibleMessageContent
                                    markdown={msg.content}
                                    streaming={Boolean(!msg.durationMs && isLastMsgStreaming && i === messages.length - 1)}
                                  />
                                  {/* Artifact download cards */}
                                  {msg.hasArtifact && msg.missionId && (
                                    <div className="mt-3 mb-2 space-y-1.5">
                                      <span className="text-[10px] text-gray-400 dark:text-white/40">成果物下载</span>
                                      <div className="flex gap-2">
                                        <a
                                          href={`/api/missions/${msg.missionId}/artifacts?format=md`}
                                          download
                                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50/80 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer group flex-1"
                                        >
                                          <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center flex-shrink-0">
                                            <FileText size={16} className="text-sky-500" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium text-foreground group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                                              Markdown
                                            </div>
                                            <div className="text-[10px] text-muted-foreground">.md 文件</div>
                                          </div>
                                          <Download size={14} className="text-muted-foreground group-hover:text-sky-500 transition-colors flex-shrink-0" />
                                        </a>
                                        <a
                                          href={`/api/missions/${msg.missionId}/artifacts?format=docx`}
                                          download
                                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50/80 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer group flex-1"
                                        >
                                          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                                            <FileText size={16} className="text-indigo-500" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                              Word
                                            </div>
                                            <div className="text-[10px] text-muted-foreground">.doc 文件</div>
                                          </div>
                                          <Download size={14} className="text-muted-foreground group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                                        </a>
                                      </div>
                                    </div>
                                  )}
                                  {/* Action bars — only for completed messages */}
                                  {msg.durationMs && (
                                    <>
                                      <MessageActions
                                        messageContent={msg.content}
                                        employeeSlug={employeeId}
                                        userPrompt={
                                          messages[i - 1]?.role === "user"
                                            ? messages[i - 1]?.content
                                            : undefined
                                        }
                                        onRegenerate={
                                          onRegenerate && !viewingSaved
                                            ? () => onRegenerate(i)
                                            : undefined
                                        }
                                        onFavorite={
                                          !viewingSaved && !isSaved
                                            ? onSave
                                            : undefined
                                        }
                                        isFavorited={isSaved}
                                      />
                                      {!isGroup && <MessageActionBar onAction={onSendMessage} />}
                                    </>
                                  )}
                                </div>
                              </div>
                            </ChatActionContext.Provider>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}


              {/* ── Thinking indicator (before text arrives) ── */}
              {loading &&
                messages.length > 0 &&
                !messages[messages.length - 1].content && (
                  <div className="flex gap-3">
                    <EmployeeAvatar
                      employeeId={isGroup && groupChatState?.activeSpeaker ? groupChatState.activeSpeaker : employeeId}
                      size="sm"
                      className="mt-0.5 flex-shrink-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Loader2
                          size={14}
                          className="animate-spin text-blue-500"
                        />
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                          {isGroup && groupChatState?.activeSpeaker
                            ? `${(groupChatState.participants.find((p: any) => p.participantId === groupChatState.activeSpeaker) as any)?.participantName ?? displayTitle}正在思考...`
                            : `${displayTitle}正在思考...`
                          }
                        </span>
                        {currentRefCount > 0 && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <BookOpen size={12} />
                            已引用{currentRefCount}篇资料
                          </span>
                        )}
                      </div>

                      {/* Thinking steps */}
                      {currentThinking.length > 0 && (
                        <div className="mb-2 space-y-1">
                          {currentThinking.map((step, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 animate-in fade-in slide-in-from-left-2 duration-300"
                            >
                              <div className="w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                              <span>{step.label}</span>
                              {idx === currentThinking.length - 1 && (
                                <Loader2
                                  size={10}
                                  className="animate-spin text-gray-400"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Live skills during thinking */}
                      {currentSkillsUsed.length > 0 && (
                        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                          <span className="text-[11px] text-gray-400 mr-0.5">
                            使用技能
                          </span>
                          {currentSkillsUsed.map((s) => (
                            <span
                              key={s.tool}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/30 text-[11px] text-violet-600 dark:text-violet-400 animate-in fade-in zoom-in-95 duration-200"
                            >
                              <Sparkles size={10} />
                              {s.skillName}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Live sources during thinking */}
                      {currentSources.length > 0 && (
                        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                          {currentSources.slice(0, 6).map((src) => (
                            <span
                              key={src}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[11px] text-blue-600 dark:text-blue-400 animate-in fade-in zoom-in-95 duration-200"
                            >
                              <Globe size={10} />
                              {src}
                            </span>
                          ))}
                          {currentSources.length > 6 && (
                            <span className="text-[11px] text-gray-400">
                              +{currentSources.length - 6}个来源
                            </span>
                          )}
                        </div>
                      )}

                      <div className="bg-gradient-to-br from-white/80 to-gray-50/70 dark:from-gray-800/60 dark:to-gray-800/40 backdrop-blur-sm rounded-2xl px-5 py-4 shadow-[0_1px_6px_rgba(0,0,0,0.06)] ring-1 ring-gray-200/30 dark:ring-gray-700/30">
                        <div className="flex gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 animate-bounce [animation-delay:0ms]" />
                          <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 animate-bounce [animation-delay:150ms]" />
                          <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 animate-bounce [animation-delay:300ms]" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
            </>
          )}
          <div />
        </div>

        {/* Scroll to bottom button */}
        {showScrollDown && messages.length > 0 && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-9 h-9 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-[0_2px_12px_rgba(0,0,0,0.12)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.18)] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer animate-in fade-in zoom-in-95 duration-200 border-0"
          >
            <ChevronDown
              size={18}
              className="text-gray-500 dark:text-gray-400"
            />
          </button>
        )}
      </div>

      {/* ── Bottom input bar (pinned) ── */}
      {(!viewingSaved || isGroup) && (
        <div className="relative flex-shrink-0">
          {/* Scenario quick-action chips — 默认只露一行（6 个），超过则收起
              并提供"展开"按钮。单行用 overflow-hidden + 固定 max-h 防换行。*/}
          {scenarios.length > 0 && (() => {
            const COLLAPSED_COUNT = 6;
            const hasMore = scenarios.length > COLLAPSED_COUNT;
            const visible = scenariosExpanded || !hasMore
              ? scenarios
              : scenarios.slice(0, COLLAPSED_COUNT);
            return (
              <div className="flex flex-wrap gap-1.5 px-5 pt-2.5 pb-1">
                {visible.map((s) => {
                  const Icon = ICON_MAP[s.icon ?? ""] || Sparkles;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/[0.03] dark:bg-blue-400/[0.06] text-[11px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-500/[0.08] dark:hover:bg-blue-400/[0.12] hover:text-blue-800 dark:hover:text-blue-200 transition-all duration-200 border-0"
                      onClick={(e) => {
                        e.preventDefault();
                        onSelectScenario(s);
                      }}
                    >
                      <Icon size={12} />
                      {s.name}
                    </button>
                  );
                })}
                {hasMore && (
                  <button
                    type="button"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/[0.03] dark:bg-blue-400/[0.06] text-[11px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-500/[0.08] dark:hover:bg-blue-400/[0.12] transition-all duration-200 border-0"
                    onClick={(e) => {
                      e.preventDefault();
                      setScenariosExpanded((v) => !v);
                    }}
                  >
                    <ChevronDown
                      size={12}
                      className={cn(
                        "transition-transform duration-200",
                        scenariosExpanded && "rotate-180",
                      )}
                    />
                    {scenariosExpanded
                      ? "收起"
                      : `展开 +${scenarios.length - COLLAPSED_COUNT}`}
                  </button>
                )}
              </div>
            );
          })()}

          <div className="px-5 pt-1.5 pb-3">
            <div
              ref={borderBoxRef}
              className="relative rounded-2xl p-[1px]"
              onMouseEnter={() => setInputHovered(true)}
              onMouseLeave={() => setInputHovered(false)}
            >
              {/* SVG border-draw animation */}
              {borderSize.w > 0 && (
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox={`0 0 ${borderSize.w} ${borderSize.h}`}
                  fill="none"
                >
                  <defs>
                    <filter id="chat-border-glow">
                      <feGaussianBlur stdDeviation="2" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <path
                    ref={pathRef}
                    d={buildBorderPath(borderSize.w, borderSize.h, 16)}
                    className="stroke-blue-400 dark:stroke-blue-500"
                    strokeWidth="1"
                    pathLength={1}
                    strokeDasharray="1"
                    strokeDashoffset="1"
                  />
                  <path
                    ref={glowRef}
                    d={buildBorderPath(borderSize.w, borderSize.h, 16)}
                    className="stroke-blue-500 dark:stroke-blue-400"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    pathLength={1}
                    strokeDasharray="0.04 0.96"
                    strokeDashoffset="0"
                    filter="url(#chat-border-glow)"
                    opacity="0"
                  />
                </svg>
              )}

              {/* Static gray border */}
              <div
                className={cn(
                  "absolute inset-0 rounded-2xl border border-gray-200/70 dark:border-gray-700/60 pointer-events-none transition-opacity duration-200",
                  borderActive || borderDone ? "opacity-0" : "opacity-100"
                )}
              />

              {/* Inner content */}
              <div className="relative rounded-[15px] bg-white dark:bg-gray-800">
                {isGroup && groupMemberItems.length > 0 && (
                  <CommandPopover
                    items={groupMemberItems}
                    visible={groupAtTrigger.visible}
                    onSelect={(item) => {
                      const m = EMPLOYEE_META[item.id as EmployeeId];
                      const mention = `@${m?.name ?? item.id}`;
                      setInputText((prev) => {
                        const cursor = textareaRef.current?.selectionStart ?? prev.length;
                        const before = prev.slice(0, cursor);
                        const atIdx = before.lastIndexOf("@");
                        if (atIdx >= 0) {
                          return prev.slice(0, atIdx) + mention + " " + prev.slice(cursor);
                        }
                        return prev + mention + " ";
                      });
                      groupAtTrigger.handleSelect();
                      setTimeout(() => textareaRef.current?.focus(), 0);
                    }}
                    onClose={groupAtTrigger.resetTrigger}
                    filterText={groupAtTrigger.filterText}
                    title="群内成员"
                  />
                )}
                {/* Attachment chips */}
                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-4 pt-3">
                    {attachedFiles.map((f, i) => {
                      const isImage = f.type.startsWith("image/");
                      return (
                        <span
                          key={`${f.name}-${i}`}
                          className="inline-flex items-center gap-1.5 max-w-[200px] pl-2 pr-1 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[11px] text-blue-700 dark:text-blue-300"
                        >
                          {isImage ? (
                            <ImageIcon size={12} className="flex-shrink-0" />
                          ) : (
                            <Paperclip size={12} className="flex-shrink-0" />
                          )}
                          <span className="truncate">{f.name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              removeAttachment(i);
                            }}
                            className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-blue-500/70 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-all border-0"
                            aria-label="移除附件"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                {messages.length === 0 && suggestions && suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-4 pt-3">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        className="text-xs px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors border-0"
                        onClick={() => {
                          if (!loading && !isStreaming && onSendMessage) {
                            onSendMessage(s);
                          }
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100 resize-none px-4 pt-3 pb-1 border-0 min-h-[72px]"
                  rows={3}
                  placeholder={
                    isRecording
                      ? "正在聆听，请说话..."
                      : `和${displayTitle}自由对话...`
                  }
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    if (isGroup) {
                      groupAtTrigger.handleChange(e.target.value, e.target.selectionStart);
                    }
                  }}
                  onCompositionStart={() => {
                    if (isGroup) groupAtTrigger.handleCompositionStart();
                  }}
                  onCompositionEnd={() => {
                    if (isGroup) groupAtTrigger.handleCompositionEnd();
                  }}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  onKeyDown={(e) => {
                    if (isGroup && groupAtTrigger.visible) return;
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                {/* Hidden file inputs */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={handleFilesPicked}
                />
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={handleFilesPicked}
                />
                <div className="flex items-center justify-between px-3 pb-2.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setTimeout(() => fileInputRef.current?.click(), 0);
                      }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all duration-200 border-0"
                      aria-label="上传文件"
                      title="上传文件"
                    >
                      <Paperclip size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setTimeout(() => imageInputRef.current?.click(), 0);
                      }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all duration-200 border-0"
                      aria-label="上传图片"
                      title="上传图片"
                    >
                      <ImageIcon size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        toggleVoiceInput();
                      }}
                      disabled={!voiceSupported}
                      className={cn(
                        "relative w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 border-0",
                        isRecording
                          ? "text-red-500 bg-red-50 dark:bg-red-900/30"
                          : "text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30",
                        !voiceSupported && "opacity-40 cursor-not-allowed hover:bg-transparent"
                      )}
                      aria-label={isRecording ? "停止语音输入" : "语音输入"}
                      title={
                        !voiceSupported
                          ? "当前浏览器不支持语音识别"
                          : isRecording
                            ? "点击停止录音"
                            : "点击开始语音输入"
                      }
                    >
                      <Mic size={15} />
                      {isRecording && (
                        <span className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-red-400/60 animate-[send-pulse_1.4s_ease-in-out_infinite]" />
                      )}
                    </button>
                    <span className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />
                    <ModelSwitcher
                      value={selectedModel}
                      onChange={setSelectedModel}
                      size="sm"
                    />
                  </div>
                  <button
                    type="button"
                    className={cn(
                      "send-btn group relative flex-shrink-0 w-[35px] h-[35px] rounded-[10px] flex items-center justify-center transition-all duration-300 border-0",
                      (inputText.trim() || attachedFiles.length > 0) && !loading
                        ? "send-btn--active cursor-pointer text-white shadow-[0_6px_18px_-6px_rgba(79,70,229,0.55)] hover:shadow-[0_10px_26px_-8px_rgba(139,92,246,0.7)] hover:scale-[1.08] active:scale-95"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      handleSend();
                    }}
                    disabled={loading || (!inputText.trim() && attachedFiles.length === 0)}
                    aria-label="发送"
                  >
                    {(inputText.trim() || attachedFiles.length > 0) && !loading && (
                      <>
                        {/* Rotating 7-color rainbow halo — flush with button edge (0px) */}
                        <span
                          className="pointer-events-none absolute inset-0 rounded-[10px] opacity-85 group-hover:opacity-100 transition-opacity duration-300"
                          style={{
                            background:
                              "conic-gradient(from 0deg, #38bdf8, #6366f1, #a855f7, #ec4899, #f59e0b, #10b981, #06b6d4, #38bdf8)",
                            animation: "send-halo-spin 4s linear infinite",
                          }}
                        />
                        {/* Inner filled gradient — masks halo to a thin rotating rim */}
                        <span className="absolute inset-0 rounded-[10px] bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600" />
                        {/* Breathing inner highlight */}
                        <span className="pointer-events-none absolute inset-[2px] rounded-[8px] bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,255,255,0.5),transparent_65%)] animate-[send-breathe_2.6s_ease-in-out_infinite]" />
                        {/* Ambient pulse ring */}
                        <span className="pointer-events-none absolute inset-0 rounded-[10px] animate-[send-pulse_1.8s_ease-in-out_infinite]" />
                        {/* Shine sweep on hover */}
                        <span className="pointer-events-none absolute inset-0 rounded-[10px] overflow-hidden">
                          <span className="absolute -inset-y-2 -left-1/2 w-1/2 rotate-12 bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-0 group-hover:opacity-100 group-hover:left-[120%] transition-all duration-700 ease-out" />
                        </span>
                      </>
                    )}
                    {/* Icon */}
                    <span className="relative z-10 flex items-center justify-center">
                      {loading ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Send
                          size={15}
                          className={cn(
                            "transition-all duration-300 -translate-x-[1px]",
                            inputText.trim() || attachedFiles.length > 0
                              ? "drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)] group-hover:translate-x-[3px] group-hover:-translate-y-[3px] group-hover:rotate-[12deg] group-active:translate-x-[8px] group-active:-translate-y-[8px] group-active:rotate-[20deg] group-active:opacity-0 group-active:duration-200"
                              : ""
                          )}
                        />
                      )}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
