"use client";

import { MessageBubble } from "./message-bubble";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TeamMessage } from "@/lib/types";

interface ActivityFeedProps {
  messages: TeamMessage[];
  missionId?: string;
  maxHeight?: string;
}

export function ActivityFeed({ messages, missionId, maxHeight = "600px" }: ActivityFeedProps) {
  const sorted = [...messages].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <ScrollArea style={{ maxHeight }}>
      <div className="flex flex-col gap-3 pr-4">
        {sorted.map((msg) => (
          <MessageBubble key={msg.id} message={msg} missionId={missionId} />
        ))}
      </div>
    </ScrollArea>
  );
}
