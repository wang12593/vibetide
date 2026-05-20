"use client";

import { useEffect, useState, useCallback } from "react";
import { GlassCard } from "./glass-card";
import { EmployeeAvatar } from "./employee-avatar";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Circle,
  Loader2,
  PauseCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Send,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type TaskStatus =
  | "pending"
  | "ready"
  | "claimed"
  | "in_progress"
  | "in_review"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"
  | "blocked";

interface PipelineTask {
  id: string;
  title: string;
  status: TaskStatus;
  progress: number;
  assignedEmployeeId: string | null;
  pauseReason?: string | null;
  pendingInputFields?: Array<{
    id: string;
    label: string;
    type: "text" | "select" | "confirm";
    options?: Array<{ label: string; value: string }>;
    required?: boolean;
  }> | null;
  dependencies?: string[];
}

interface StepPipelineProps {
  missionId: string;
  tasks: PipelineTask[];
  onTaskResume?: (taskId: string, userInput: Record<string, unknown>) => void;
}

const STATUS_CONFIG: Record<
  TaskStatus,
  { icon: typeof Circle; color: string; bg: string; label: string }
> = {
  pending: { icon: Circle, color: "text-gray-400", bg: "bg-gray-100 dark:bg-gray-800", label: "等待中" },
  ready: { icon: Circle, color: "text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/30", label: "就绪" },
  claimed: { icon: Circle, color: "text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/30", label: "已认领" },
  in_progress: { icon: Loader2, color: "text-sky-500", bg: "bg-sky-50 dark:bg-sky-900/30", label: "执行中" },
  in_review: { icon: Loader2, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/30", label: "审核中" },
  paused: { icon: PauseCircle, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/30", label: "已暂停" },
  completed: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/30", label: "已完成" },
  failed: { icon: XCircle, color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/30", label: "失败" },
  cancelled: { icon: XCircle, color: "text-gray-400", bg: "bg-gray-100 dark:bg-gray-800", label: "已取消" },
  blocked: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-900/30", label: "已阻塞" },
};

function TaskNode({
  task,
  allTasks,
  onResume,
}: {
  task: PipelineTask;
  allTasks: PipelineTask[];
  onResume?: (taskId: string, userInput: Record<string, unknown>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const config = STATUS_CONFIG[task.status];
  const Icon = config.icon;
  const isAnimating = task.status === "in_progress" || task.status === "in_review";
  const isPaused = task.status === "paused";

  const depTasks = (task.dependencies || []).map((depId) =>
    allTasks.find((t) => t.id === depId)
  );

  const handleResume = useCallback(async () => {
    if (!onResume) return;
    setSubmitting(true);
    try {
      const userInput: Record<string, unknown> = {};
      for (const field of task.pendingInputFields || []) {
        userInput[field.id] = inputValues[field.id] || "";
      }
      onResume(task.id, userInput);
    } finally {
      setSubmitting(false);
    }
  }, [onResume, task.id, task.pendingInputFields, inputValues]);

  return (
    <div className="flex gap-3 items-start">
      <div className="flex flex-col items-center shrink-0 pt-0.5">
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center",
            config.bg
          )}
        >
          <Icon
            size={16}
            className={cn(config.color, isAnimating && "animate-spin")}
          />
        </div>
        <div className="w-px flex-1 bg-border/40 mt-1 min-h-[20px]" />
      </div>

      <div className="flex-1 min-w-0 pb-4">
        <GlassCard variant="default" padding="sm" hover={isPaused}>
          <div className="flex items-center gap-2">
            {task.assignedEmployeeId && (
              <EmployeeAvatar
                employeeId={task.assignedEmployeeId}
                size="xs"
              />
            )}
            <span className="text-sm font-medium truncate flex-1">
              {task.title}
            </span>
            <span
              className={cn(
                "text-[11px] px-2 py-0.5 rounded-full",
                config.bg,
                config.color
              )}
            >
              {config.label}
            </span>
            {(isPaused || depTasks.length > 0) && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-0.5 hover:bg-muted rounded cursor-pointer bg-transparent border-0"
              >
                {expanded ? (
                  <ChevronUp size={14} className="text-muted-foreground" />
                ) : (
                  <ChevronDown size={14} className="text-muted-foreground" />
                )}
              </button>
            )}
          </div>

          {task.status === "in_progress" && task.progress > 0 && (
            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-500 rounded-full transition-all duration-500"
                style={{ width: `${task.progress}%` }}
              />
            </div>
          )}

          {expanded && depTasks.length > 0 && (
            <div className="mt-2 pl-2 border-l-2 border-border/40 space-y-1">
              {depTasks.map(
                (dep) =>
                  dep && (
                    <div
                      key={dep.id}
                      className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                    >
                      {(() => {
                        const depConfig = STATUS_CONFIG[dep.status];
                        const DepIcon = depConfig.icon;
                        return (
                          <DepIcon size={10} className={depConfig.color} />
                        );
                      })()}
                      <span className="truncate">{dep.title}</span>
                    </div>
                  )
              )}
            </div>
          )}

          {expanded && isPaused && (
            <div className="mt-3 space-y-2">
              {task.pauseReason && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {task.pauseReason}
                </p>
              )}
              {task.pendingInputFields?.map((field) => (
                <div key={field.id} className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    {field.label}
                    {field.required && (
                      <span className="text-red-400 ml-0.5">*</span>
                    )}
                  </label>
                  {field.type === "select" && field.options ? (
                    <div className="flex flex-wrap gap-1.5">
                      {field.options.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() =>
                            setInputValues((prev) => ({
                              ...prev,
                              [field.id]: opt.value,
                            }))
                          }
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[11px] cursor-pointer transition-colors border-0",
                            inputValues[field.id] === opt.value
                              ? "bg-sky-500 text-white"
                              : "bg-muted hover:bg-muted/80 text-foreground"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  ) : field.type === "confirm" ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setInputValues((prev) => ({
                            ...prev,
                            [field.id]: "yes",
                          }))
                        }
                        className={cn(
                          "px-3 py-1 rounded-lg text-[11px] cursor-pointer border-0 transition-colors",
                          inputValues[field.id] === "yes"
                            ? "bg-emerald-500 text-white"
                            : "bg-muted hover:bg-muted/80"
                        )}
                      >
                        确认
                      </button>
                      <button
                        onClick={() =>
                          setInputValues((prev) => ({
                            ...prev,
                            [field.id]: "no",
                          }))
                        }
                        className={cn(
                          "px-3 py-1 rounded-lg text-[11px] cursor-pointer border-0 transition-colors",
                          inputValues[field.id] === "no"
                            ? "bg-red-500 text-white"
                            : "bg-muted hover:bg-muted/80"
                        )}
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <Input
                      value={inputValues[field.id] || ""}
                      onChange={(e) =>
                        setInputValues((prev) => ({
                          ...prev,
                          [field.id]: e.target.value,
                        }))
                      }
                      placeholder={field.label}
                      className="h-7 text-xs"
                    />
                  )}
                </div>
              ))}
              <Button
                size="sm"
                onClick={handleResume}
                disabled={submitting}
                className="w-full h-7 text-xs gap-1"
              >
                <Send size={12} />
                {submitting ? "提交中..." : "提交并继续"}
              </Button>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

export function StepPipeline({ missionId, tasks, onTaskResume }: StepPipelineProps) {
  const [liveTasks, setLiveTasks] = useState<PipelineTask[]>(tasks);

  useEffect(() => {
    setLiveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    if (!missionId) return;

    const eventSource = new EventSource(`/api/missions/${missionId}/progress`);

    eventSource.addEventListener("task-update", (e) => {
      try {
        const update = JSON.parse(e.data) as {
          taskId: string;
          status: TaskStatus;
          progress: number;
          title: string;
          assignedEmployeeId: string | null;
        };
        setLiveTasks((prev) =>
          prev.map((t) =>
            t.id === update.taskId
              ? { ...t, status: update.status, progress: update.progress }
              : t
          )
        );
      } catch {}
    });

    eventSource.addEventListener("mission-completed", () => {
      eventSource.close();
    });

    eventSource.addEventListener("error", () => {
      eventSource.close();
    });

    return () => {
      eventSource.close();
    };
  }, [missionId]);

  useEffect(() => {
    if (!missionId) return;
    let active = true;

    const pollPaused = async () => {
      if (!active) return;
      try {
        const res = await fetch(`/api/missions/${missionId}/interact`);
        if (res.ok) {
          const data = await res.json();
          const pausedMap = new Map(
            (data.pausedTasks as PipelineTask[]).map((t) => [t.id, t])
          );
          if (pausedMap.size > 0) {
            setLiveTasks((prev) =>
              prev.map((t) => {
                const paused = pausedMap.get(t.id);
                return paused
                  ? {
                      ...t,
                      status: "paused",
                      pauseReason: paused.pauseReason,
                      pendingInputFields: paused.pendingInputFields,
                    }
                  : t;
              })
            );
          }
        }
      } catch {}
      if (active) setTimeout(pollPaused, 3000);
    };
    pollPaused();

    return () => {
      active = false;
    };
  }, [missionId]);

  const statusOrder: TaskStatus[] = [
    "in_progress",
    "paused",
    "in_review",
    "ready",
    "pending",
    "completed",
    "failed",
    "blocked",
    "cancelled",
  ];
  const sorted = [...liveTasks].sort((a, b) => {
    const ai = statusOrder.indexOf(a.status);
    const bi = statusOrder.indexOf(b.status);
    if (ai !== bi) return ai - bi;
    return (b.progress || 0) - (a.progress || 0);
  });

  return (
    <div className="space-y-0">
      {sorted.map((task) => (
        <TaskNode
          key={task.id}
          task={task}
          allTasks={sorted}
          onResume={onTaskResume}
        />
      ))}
    </div>
  );
}
