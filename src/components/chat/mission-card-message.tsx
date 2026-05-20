"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  ExternalLink,
  StopCircle,
} from "lucide-react";
import { useMissionProgress } from "@/lib/hooks/use-mission-progress";
import { GlassCard } from "@/components/shared/glass-card";
import { cancelMission } from "@/app/actions/missions";

interface MissionCardMessageProps {
  missionId: string;
  templateName: string;
}

export function MissionCardMessage({
  missionId,
  templateName,
}: MissionCardMessageProps) {
  const state = useMissionProgress(missionId);
  const [cancelling, setCancelling] = React.useState(false);

  const handleCancel = React.useCallback(async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      await cancelMission(missionId);
    } catch {
      setCancelling(false);
    }
  }, [missionId, cancelling]);

  if (state.isLoading) {
    return (
      <GlassCard
        padding="sm"
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Loader2 size={14} className="animate-spin" />
        正在启动「{templateName}」…
      </GlassCard>
    );
  }

  if (state.notFound) {
    return (
      <GlassCard
        padding="sm"
        className="flex items-center gap-2 text-sm text-muted-foreground opacity-60"
      >
        <AlertCircle size={14} />
        任务「{templateName}」已被删除
      </GlassCard>
    );
  }

  const tasks = Object.values(state.tasksById);
  const isTerminal = ["completed", "failed", "cancelled"].includes(state.status);

  return (
    <GlassCard padding="md" className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon status={state.status} />
          <span className="font-medium text-sm">{templateName}</span>
          {isTerminal && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                state.status === "completed"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {state.status === "completed"
                ? "已完成"
                : state.status === "failed"
                  ? "执行失败"
                  : "已取消"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isTerminal && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="text-xs text-muted-foreground hover:text-red-500 disabled:opacity-50 inline-flex items-center gap-1 transition-colors"
            >
              {cancelling ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <StopCircle size={12} />
              )}
              {cancelling ? "取消中…" : "取消任务"}
            </button>
          )}
          <Link
            href={`/missions/${missionId}`}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            查看详情
            <ExternalLink size={12} />
          </Link>
        </div>
      </div>
      {tasks.length > 0 && (
        <div className="space-y-1.5">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </div>
      )}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {tasks.length > 0
              ? `${tasks.filter((t) => t.status === "completed").length}/${tasks.length} 子任务`
              : "等待中"}
          </span>
          <span>{state.progress}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              state.status === "completed"
                ? "bg-green-500"
                : state.status === "failed" || state.status === "cancelled"
                  ? "bg-red-400"
                  : "bg-sky-500"
            }`}
            style={{ width: `${Math.min(state.progress, 100)}%` }}
          />
        </div>
      </div>
    </GlassCard>
  );
}

function StatusIcon({
  status,
}: {
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
}) {
  if (status === "completed") {
    return <CheckCircle2 size={16} className="text-green-500" />;
  }
  if (status === "failed" || status === "cancelled") {
    return <XCircle size={16} className="text-red-500" />;
  }
  return <Loader2 size={16} className="text-sky-500 animate-spin" />;
}

function TaskRow({
  task,
}: {
  task: {
    title: string;
    status: "pending" | "running" | "completed" | "failed" | "skipped";
  };
}) {
  const icon =
    task.status === "completed" ? "✅" :
    task.status === "failed" ? "❌" :
    task.status === "running" ? "🔄" :
    task.status === "skipped" ? "⏭️" :
    "⏳";
  return (
    <div className="text-xs text-muted-foreground flex items-center gap-2">
      <span>{icon}</span>
      <span>{task.title}</span>
    </div>
  );
}
