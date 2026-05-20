"use client";

import { useState, useCallback } from "react";
import { createChatContext, type ChatContext } from "@/lib/chat/group-router";

export type GroupChatPhase =
  | "idle"
  | "planning"
  | "executing"
  | "summarizing";

export type GroupChatMode = "serial" | "parallel";

export function useGroupChat() {
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [executionQueue, setExecutionQueue] = useState<string[]>([]);
  const [mode, setMode] = useState<GroupChatMode>("serial");
  const [phase, setPhase] = useState<GroupChatPhase>("idle");
  const [focusEmployeeId, setFocusEmployeeId] = useState<string | null>(null);
  const [chatContext, setChatContext] = useState<ChatContext>(createChatContext);

  const startExecution = useCallback(
    (queue: string[], execMode: GroupChatMode) => {
      setExecutionQueue(queue);
      setMode(execMode);
      setPhase("executing");
      if (queue.length > 0) setActiveSpeaker(queue[0]);
    },
    []
  );

  const advanceSpeaker = useCallback((nextSpeaker?: string) => {
    if (nextSpeaker) {
      setActiveSpeaker(nextSpeaker);
    } else {
      setActiveSpeaker(null);
      setPhase("idle");
      setExecutionQueue([]);
    }
  }, []);

  const reset = useCallback(() => {
    setActiveSpeaker(null);
    setExecutionQueue([]);
    setPhase("idle");
    setFocusEmployeeId(null);
  }, []);

  return {
    activeSpeaker,
    executionQueue,
    mode,
    phase,
    focusEmployeeId,
    chatContext,
    setActiveSpeaker,
    setFocusEmployeeId,
    setChatContext,
    startExecution,
    advanceSpeaker,
    setPhase,
    reset,
  };
}
