"use client";

import { cn } from "@/lib/utils";
import { Check, Loader2, Circle, GitBranch } from "lucide-react";

export type ChainStep = {
  label: string;
  employeeName?: string;
  status: "done" | "active" | "pending";
};

export type ParallelTrack = {
  label: string;
  employeeName: string;
  status: "done" | "active" | "pending";
  summary?: string;
};

interface ChainProgressProps {
  steps: ChainStep[];
  className?: string;
}

interface ParallelProgressProps {
  tracks: ParallelTrack[];
  leaderName?: string;
  leaderStatus?: "done" | "active" | "pending";
  className?: string;
}

export function ChainProgress({ steps, className }: ChainProgressProps) {
  return (
    <div className={cn("flex items-center gap-1.5 text-xs", className)}>
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {i > 0 && (
            <div
              className={cn(
                "w-4 h-px",
                step.status === "done"
                  ? "bg-green-400"
                  : "bg-gray-300 dark:bg-gray-600"
              )}
            />
          )}
          <div className="flex items-center gap-1">
            {step.status === "done" ? (
              <Check size={12} className="text-green-500" />
            ) : step.status === "active" ? (
              <Loader2 size={12} className="text-blue-500 animate-spin" />
            ) : (
              <Circle size={12} className="text-gray-400" />
            )}
            <span
              className={cn(
                "whitespace-nowrap",
                step.status === "done"
                  ? "text-green-600 dark:text-green-400"
                  : step.status === "active"
                  ? "text-blue-600 dark:text-blue-400 font-medium"
                  : "text-gray-400"
              )}
            >
              {step.employeeName
                ? `${step.employeeName}·${step.label}`
                : step.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ParallelProgress({
  tracks,
  leaderName,
  leaderStatus,
  className,
}: ParallelProgressProps) {
  const allDone = tracks.every((t) => t.status === "done");
  const anyActive = tracks.some((t) => t.status === "active");

  return (
    <div className={cn("text-xs", className)}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <GitBranch size={12} className="text-violet-500" />
        <span className="text-violet-600 dark:text-violet-400 font-medium whitespace-nowrap">
          并行执行
        </span>
        {anyActive && (
          <span className="text-gray-400 whitespace-nowrap">
            ({tracks.filter((t) => t.status === "done").length}/{tracks.length}
            )
          </span>
        )}
        {allDone && (
          <Check size={12} className="text-green-500" />
        )}
      </div>

      <div className="ml-1 border-l-2 border-violet-200 dark:border-violet-800 pl-3 space-y-1">
        {tracks.map((track, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {track.status === "done" ? (
              <Check size={11} className="text-green-500 shrink-0" />
            ) : track.status === "active" ? (
              <Loader2
                size={11}
                className="text-blue-500 animate-spin shrink-0"
              />
            ) : (
              <Circle size={11} className="text-gray-400 shrink-0" />
            )}
            <span
              className={cn(
                "whitespace-nowrap",
                track.status === "done"
                  ? "text-green-600 dark:text-green-400"
                  : track.status === "active"
                  ? "text-blue-600 dark:text-blue-400 font-medium"
                  : "text-gray-400"
              )}
            >
              {track.employeeName}
            </span>
            {track.summary && track.status === "done" && (
              <span className="text-gray-400 truncate max-w-[120px]" title={track.summary}>
                {track.summary}
              </span>
            )}
          </div>
        ))}
      </div>

      {leaderName && (
        <div className="ml-1 mt-1.5 flex items-center gap-1.5">
          <div className="w-2 h-px bg-violet-300 dark:bg-violet-700" />
          {leaderStatus === "done" ? (
            <Check size={11} className="text-green-500 shrink-0" />
          ) : leaderStatus === "active" ? (
            <Loader2
              size={11}
              className="text-blue-500 animate-spin shrink-0"
            />
          ) : (
            <Circle size={11} className="text-gray-400 shrink-0" />
          )}
          <span
            className={cn(
              "whitespace-nowrap",
              leaderStatus === "done"
                ? "text-green-600 dark:text-green-400"
                : leaderStatus === "active"
                ? "text-blue-600 dark:text-blue-400 font-medium"
                : "text-gray-400"
            )}
          >
            {leaderName}·汇总
          </span>
        </div>
      )}
    </div>
  );
}
