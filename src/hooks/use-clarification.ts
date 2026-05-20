"use client";

import { useState, useCallback, useRef } from "react";
import { parseSSE } from "@/lib/chat-utils";
import type { ClarificationSession, ClarificationRound } from "@/lib/agent/types";

export interface UseClarificationReturn {
  session: ClarificationSession | null;
  isClarifying: boolean;
  clarificationMessages: ClarificationRound[];
  confirmedParameters: Record<string, string> | null;
  startClarification: (message: string, conversationId?: string) => Promise<void>;
  submitClarificationResponse: (message: string) => Promise<void>;
  skipClarification: () => void;
  confirmParameters: () => void;
  resetClarification: () => void;
}

export function useClarification(): UseClarificationReturn {
  const [session, setSession] = useState<ClarificationSession | null>(null);
  const [isClarifying, setIsClarifying] = useState(false);
  const [clarificationMessages, setClarificationMessages] = useState<ClarificationRound[]>([]);
  const [confirmedParameters, setConfirmedParameters] = useState<Record<string, string> | null>(null);

  const sessionIdRef = useRef<string | null>(null);

  const startClarification = useCallback(async (message: string, conversationId?: string) => {
    setIsClarifying(true);
    setClarificationMessages([]);
    setConfirmedParameters(null);

    try {
      const res = await fetch("/api/chat/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationId }),
      });

      if (!res.ok) {
        setIsClarifying(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setIsClarifying(false);
        return;
      }

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

            if (evt.event === "clarification-question") {
              sessionIdRef.current = payload.sessionId;
              setSession((prev) => ({
                id: payload.sessionId,
                conversationId: prev?.conversationId ?? conversationId ?? "",
                intentType: prev?.intentType ?? "general_chat",
                parameters: payload.parameters ?? {},
                rounds: [
                  ...(prev?.rounds ?? []),
                  { role: "system", content: payload.question ?? "", timestamp: Date.now() },
                ],
                status: "active",
                createdAt: prev?.createdAt ?? Date.now(),
                updatedAt: Date.now(),
              }));
              setClarificationMessages((prev) => [
                ...prev,
                { role: "system", content: payload.question ?? "", timestamp: Date.now() },
              ]);
            }

            if (evt.event === "clarification-complete") {
              sessionIdRef.current = payload.sessionId;
              setConfirmedParameters(payload.parameters ?? {});
              setIsClarifying(false);
              setSession((prev) =>
                prev
                  ? { ...prev, status: "confirmed", parameters: payload.parameters ?? {} }
                  : null
              );
            }

            if (evt.event === "parameter-update") {
              setSession((prev) =>
                prev
                  ? { ...prev, parameters: payload.parameters ?? prev.parameters }
                  : null
              );
            }

            if (evt.event === "error") {
              setIsClarifying(false);
            }
          } catch {}
        }
      }
    } catch {
      setIsClarifying(false);
    }
  }, []);

  const submitClarificationResponse = useCallback(async (message: string) => {
    const sid = sessionIdRef.current;
    if (!sid) return;

    setClarificationMessages((prev) => [
      ...prev,
      { role: "user", content: message, timestamp: Date.now() },
    ]);

    try {
      const res = await fetch("/api/chat/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId: sid }),
      });

      if (!res.ok) return;

      const reader = res.body?.getReader();
      if (!reader) return;

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

            if (evt.event === "clarification-question") {
              setSession((prev) => ({
                ...prev!,
                parameters: payload.parameters ?? prev?.parameters ?? {},
                rounds: [
                  ...(prev?.rounds ?? []),
                  { role: "system", content: payload.question ?? "", timestamp: Date.now() },
                ],
                updatedAt: Date.now(),
              }));
              setClarificationMessages((prev) => [
                ...prev,
                { role: "system", content: payload.question ?? "", timestamp: Date.now() },
              ]);
            }

            if (evt.event === "clarification-complete") {
              setConfirmedParameters(payload.parameters ?? {});
              setIsClarifying(false);
              setSession((prev) =>
                prev
                  ? { ...prev, status: "confirmed", parameters: payload.parameters ?? {} }
                  : null
              );
            }

            if (evt.event === "parameter-update") {
              setSession((prev) =>
                prev
                  ? { ...prev, parameters: payload.parameters ?? prev.parameters }
                  : null
              );
            }

            if (evt.event === "error") {
              setIsClarifying(false);
            }
          } catch {}
        }
      }
    } catch {}
  }, []);

  const skipClarification = useCallback(() => {
    setSession((prev) =>
      prev ? { ...prev, status: "skipped" } : null
    );
    setIsClarifying(false);
  }, []);

  const confirmParameters = useCallback(() => {
    setConfirmedParameters(session?.parameters ?? null);
    setIsClarifying(false);
  }, [session]);

  const resetClarification = useCallback(() => {
    setSession(null);
    setIsClarifying(false);
    setClarificationMessages([]);
    setConfirmedParameters(null);
    sessionIdRef.current = null;
  }, []);

  return {
    session,
    isClarifying,
    clarificationMessages,
    confirmedParameters,
    startClarification,
    submitClarificationResponse,
    skipClarification,
    confirmParameters,
    resetClarification,
  };
}
