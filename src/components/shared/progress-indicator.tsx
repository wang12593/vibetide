"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Loader2,
  PauseCircle,
  XCircle,
} from "lucide-react";

type MissionStatus =
  | "planning"
  | "executing"
  | "coordinating"
  | "consolidating"
  | "completed"
  | "failed"
  | "cancelled";

interface ProgressIndicatorProps {
  missionId: string;
  initialStatus?: MissionStatus;
  initialProgress?: number;
  totalTasks?: number;
  completedTasks?: number;
  className?: string;
  onComplete?: () => void;
}

const STATUS_DISPLAY: Record<
  MissionStatus,
  { label: string; color: string; icon: typeof Loader2 }
> = {
  planning: { label: "规划中", color: "text-blue-500", icon: Loader2 },
  executing: { label: "执行中", color: "text-sky-500", icon: Loader2 },
  coordinating: { label: "协调中", color: "text-amber-500", icon: Loader2 },
  consolidating: { label: "汇总中", color: "text-purple-500", icon: Loader2 },
  completed: { label: "已完成", color: "text-emerald-500", icon: CheckCircle2 },
  failed: { label: "已失败", color: "text-red-500", icon: XCircle },
  cancelled: { label: "已取消", color: "text-gray-400", icon: XCircle },
};

export function ProgressIndicator({
  missionId,
  initialStatus = "planning",
  initialProgress = 0,
  totalTasks = 0,
  completedTasks = 0,
  className,
  onComplete,
}: ProgressIndicatorProps) {
  const [status, setStatus] = useState<MissionStatus>(initialStatus);
  const [progress, setProgress] = useState(initialProgress);
  const [done, setDone] = useState(completedTasks);
  const [total, setTotal] = useState(totalTasks);

  useEffect(() => {
    if (!missionId) return;

    const es = new EventSource(`/api/missions/${missionId}/progress`);

    es.addEventListener("mission-progress", (e) => {
      try {
        const data = JSON.parse(e.data) as {
          status: MissionStatus;
          progress: number;
          completedTasks: number;
          totalTasks: number;
        };
        setStatus(data.status);
        setProgress(data.progress);
        setDone(data.completedTasks);
        setTotal(data.totalTasks);
      } catch {}
    });

    es.addEventListener("mission-completed", (e) => {
      try {
        const data = JSON.parse(e.data) as { status: MissionStatus; progress: number };
        setStatus(data.status);
        setProgress(data.progress);
      } catch {}
      es.close();
      onComplete?.();
    });

    es.addEventListener("error", () => {
      es.close();
    });

    return () => {
      es.close();
    };
  }, [missionId, onComplete]);

  const display = STATUS_DISPLAY[status];
  const Icon = display.icon;
  const isTerminal = ["completed", "failed", "cancelled"].includes(status);
  const isAnimating = !isTerminal;

  const progressColor = isTerminal
    ? status === "completed"
      ? "bg-emerald-500"
      : "bg-red-400"
    : "bg-sky-500";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon
            size={14}
            className={cn(display.color, isAnimating && "animate-spin")}
          />
          <span className={cn("text-xs font-medium", display.color)}>
            {display.label}
          </span>
        </div>
        {total > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {done}/{total} 任务
          </span>
        )}
      </div>

      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            progressColor
          )}
          style={{ width: `${Math.max(progress, 2)}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{progress}%</span>
      </div>
    </div>
  );
}
