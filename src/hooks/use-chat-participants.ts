"use client";

import { useState, useCallback } from "react";

export type ParticipantInfo = {
  participantId: string;
  participantType: "ai_employee" | "human";
  role: "leader" | "member";
  name: string;
  avatarUrl?: string;
};

export function useChatParticipants(initial?: ParticipantInfo[]) {
  const [participants, setParticipants] = useState<Map<string, ParticipantInfo>>(
    () => {
      const map = new Map<string, ParticipantInfo>();
      if (initial) {
        for (const p of initial) map.set(p.participantId, p);
      }
      return map;
    }
  );

  const addParticipant = useCallback((p: ParticipantInfo) => {
    setParticipants((prev) => {
      const next = new Map(prev);
      next.set(p.participantId, p);
      return next;
    });
  }, []);

  const removeParticipant = useCallback((id: string) => {
    setParticipants((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const aiParticipants = Array.from(participants.values()).filter(
    (p) => p.participantType === "ai_employee"
  );

  const humanParticipants = Array.from(participants.values()).filter(
    (p) => p.participantType === "human"
  );

  return {
    participants,
    aiParticipants,
    humanParticipants,
    addParticipant,
    removeParticipant,
    setParticipants: useCallback(
      (list: ParticipantInfo[]) => {
        const map = new Map<string, ParticipantInfo>();
        for (const p of list) map.set(p.participantId, p);
        setParticipants(map);
      },
      []
    ),
  };
}
