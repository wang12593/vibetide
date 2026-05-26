"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    title: string;
    snippet: string;
    relevance: number;
  }>;
}

interface KbChatClientProps {
  kbId: string;
  kbName: string;
}

export function KbChatClient({ kbId, kbName }: KbChatClientProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  const handleSend = useCallback(async () => {
    const question = input.trim();
    if (!question || loading) return;

    const userMsg: ChatMessage = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    scrollToBottom();

    try {
      const res = await fetch(`/api/knowledge-bases/${kbId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `请求失败：${data.error || "未知错误"}` },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.answer,
            sources: data.sources,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "网络错误，请稍后重试" },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [input, loading, kbId, scrollToBottom]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex flex-col h-full min-h-[500px]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 py-16">
            <BookOpen className="h-10 w-10 opacity-40" />
            <p className="text-sm">向「{kbName}」提问，AI 将基于知识库内容回答</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={cn(
              "rounded-xl px-4 py-3 text-sm leading-relaxed",
              msg.role === "user"
                ? "ml-auto max-w-[80%] bg-sky-50 text-sky-900"
                : "mr-auto max-w-[90%] bg-white/60 backdrop-blur-sm border border-white/40"
            )}
          >
            <div className="whitespace-pre-wrap break-words">{msg.content}</div>

            {msg.sources && msg.sources.length > 0 && (
              <div className="mt-3 pt-2 border-t border-white/30 space-y-1">
                <p className="text-xs text-muted-foreground font-medium">引用来源：</p>
                {msg.sources.map((s, si) => (
                  <div
                    key={si}
                    className="text-xs text-muted-foreground bg-white/40 rounded px-2 py-1"
                  >
                    <span className="font-medium">[{si + 1}]</span>{" "}
                    {s.title}
                    {s.relevance > 0 && (
                      <span className="ml-1 opacity-60">
                        (相关度 {(s.relevance * 100).toFixed(0)}%)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm px-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在思考...
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-3 border-t border-white/20">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入你的问题..."
          className="min-h-[44px] max-h-[120px] resize-none"
          rows={1}
          disabled={loading}
        />
        <Button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          size="icon"
          className="shrink-0 self-end"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
