"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useChatStream } from "@/hooks/use-chat-stream";
import type { ChatMessage } from "@/lib/chat-utils";
import {
  saveConversation,
  deleteSavedConversation,
  getLatestConversation,
  getConversationById,
  upsertConversationMessages,
} from "@/app/actions/conversations";
import { getUserSuggestions } from "@/app/actions/user-ai-preferences";
import { toast } from "sonner";
import {
  Crown,
  MessageSquare,
  Trash2,
  ArrowLeft,
  Plus,
  ChevronDown,
} from "lucide-react";

interface MulanChatClientProps {
  conversations: Array<{
    id: string;
    title: string;
    updatedAt: string;
  }>;
}

export function MulanChatClient({ conversations: initialConversations }: MulanChatClientProps) {
  const searchParams = useSearchParams();
  const conversationIdParam = searchParams.get("conversation");

  const [conversations, setConversations] = useState(initialConversations);
  const [activeConvId, setActiveConvId] = useState<string | null>(conversationIdParam);
  const [showList, setShowList] = useState(!conversationIdParam);
  const [isSaved, setIsSaved] = useState(false);
  const chat = useChatStream({ employeeSlug: "leader" });
  const saveRef = useRef(false);

  useEffect(() => {
    if (!conversationIdParam) return;
    getLatestConversation("leader").then((conv) => {
      if (conv?.id === conversationIdParam && conv.messages?.length) {
        chat.setMessages(conv.messages as ChatMessage[]);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (chat.messages.length === 0 || chat.isStreaming || chat.loading) return;
    if (saveRef.current) return;

    const lastAssistant = [...chat.messages].reverse().find((m) => m.role === "assistant" && m.content);
    if (!lastAssistant) return;

    saveRef.current = true;
    setIsSaved(false);

    const title = chat.messages[0]?.content?.slice(0, 40) || "穆兰对话";

    saveConversation({
      employeeSlug: "leader",
      title,
      messages: chat.messages as ChatMessage[],
    }).then((row) => {
      if (row?.id) {
        const id = row.id as string;
        setActiveConvId(id);
        setIsSaved(true);
        setConversations((prev) => {
          const filtered = prev.filter((c) => c.id !== id);
          return [{ id, title, updatedAt: new Date().toISOString() }, ...filtered];
        });
      }
    }).catch(() => {});
  }, [chat.messages, chat.isStreaming, chat.loading]);

  const handleNewChat = useCallback(() => {
    chat.clearMessages();
    saveRef.current = false;
    setIsSaved(false);
    setActiveConvId(null);
  }, [chat]);

  const handleDeleteConversation = useCallback(async (id: string) => {
    try {
      await deleteSavedConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvId === id) handleNewChat();
    } catch {}
  }, [activeConvId, handleNewChat]);

  const handleSelectConversation = useCallback(async (id: string) => {
    try {
      const conv = await getConversationById(id);
      if (conv?.messages) {
        chat.setMessages(conv.messages as ChatMessage[]);
        setActiveConvId(id);
        setShowList(false);
      }
    } catch {}
  }, [chat]);

  return (
    <div className="h-full flex overflow-hidden">
      <div className={cn(
        "flex-shrink-0 border-r border-border/40 bg-white/50 dark:bg-white/[0.02] flex flex-col transition-all duration-300 overflow-hidden",
        showList ? "w-64" : "w-0",
      )}>
        <div className="p-3 border-b border-border/30">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white text-xs font-medium hover:scale-[1.02] active:scale-[0.98] transition-transform cursor-pointer bg-transparent"
            style={{ background: "linear-gradient(135deg, #e11d48, #db2777)" }}
          >
            <Plus size={14} />
            新对话
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-0.5">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={cn(
                "group flex items-center gap-1.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors",
                activeConvId === conv.id
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "hover:bg-muted/50 text-foreground/80",
              )}
              onClick={() => handleSelectConversation(conv.id)}
            >
              <MessageSquare size={12} className="shrink-0" />
              <span className="text-[11px] truncate flex-1">{conv.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/10 hover:text-red-400 transition-all cursor-pointer bg-transparent"
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center py-4">暂无对话记录</p>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30 shrink-0">
          <button
            onClick={() => setShowList((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer bg-transparent"
          >
            <ChevronDown
              size={14}
              className={cn("transition-transform", showList && "rotate-180")}
            />
          </button>
          <Crown size={16} className="text-rose-500" />
          <span className="text-sm font-medium">穆兰</span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {chat.messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm text-muted-foreground">开始和穆兰对话吧</p>
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              {chat.messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-tr-sm"
                        : "bg-white/80 dark:bg-white/[0.06] rounded-tl-sm",
                    )}
                  >
                    {msg.role === "assistant" && typeof msg.content === "string" && (
                      <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                    )}
                    {msg.role === "user" && <div className="whitespace-pre-wrap break-words">{msg.content}</div>}
                  </div>
                </div>
              ))}
              {(chat.loading || chat.isStreaming) && (
                <div className="flex justify-start">
                  <div className="bg-white/80 dark:bg-white/[0.06] rounded-2xl rounded-tl-sm px-4 py-2.5">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 px-4 pb-4 pt-2">
          <div className="max-w-3xl mx-auto">
            <ChatInput chat={chat} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatInput({ chat }: { chat: ReturnType<typeof useChatStream> }) {
  const [input, setInput] = useState("");

  const handleSend = useCallback(() => {
    if (!input.trim() || chat.isStreaming) return;
    chat.sendMessage(input.trim());
    setInput("");
  }, [input, chat]);

  return (
    <div className="gemini-border rounded-2xl bg-white dark:bg-white/[0.06]">
      <div className="px-4 pt-3 pb-1">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="和穆兰说点什么…"
          rows={1}
          className="w-full bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 resize-none outline-none min-h-[32px] max-h-[100px]"
          onInput={(e) => {
            const t = e.target as HTMLTextAreaElement;
            t.style.height = "auto";
            t.style.height = `${Math.min(t.scrollHeight, 100)}px`;
          }}
        />
      </div>
      <div className="flex justify-end px-3 pb-2 pt-1">
        <button
          onClick={handleSend}
          disabled={!input.trim() || chat.isStreaming}
          className={cn(
            "flex items-center justify-center w-7 h-7 rounded-lg transition-all bg-transparent",
            input.trim() && !chat.isStreaming
              ? "bg-gradient-to-br from-rose-500 to-pink-600 text-white hover:scale-105 cursor-pointer"
              : "bg-muted text-muted-foreground/40 cursor-not-allowed",
          )}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
        </button>
      </div>
    </div>
  );
}
