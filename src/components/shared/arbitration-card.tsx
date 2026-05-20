"use client";

import { cn } from "@/lib/utils";
import { Scale, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

export type ArbitrationRound = {
  round: number;
  speakerId: string;
  speakerName: string;
  stance: string;
};

interface ArbitrationCardProps {
  conflictDescription: string;
  rounds: ArbitrationRound[];
  conclusion: string;
  maxRounds: number;
  className?: string;
}

export function ArbitrationCard({
  conflictDescription,
  rounds,
  conclusion,
  maxRounds,
  className,
}: ArbitrationCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Scale size={14} className="text-amber-600 dark:text-amber-400" />
        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
          争议仲裁
        </span>
        <span className="text-xs text-amber-500 dark:text-amber-400">
          ({rounds.length}/{maxRounds}轮)
        </span>
      </div>

      <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
        {conflictDescription}
      </p>

      {rounds.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
        >
          {expanded ? (
            <ChevronUp size={12} />
          ) : (
            <ChevronDown size={12} />
          )}
          {expanded ? "收起详情" : "查看仲裁过程"}
        </button>
      )}

      {expanded && (
        <div className="space-y-1.5 border-t border-amber-200 dark:border-amber-800 pt-2">
          {rounds.map((r, i) => (
            <div key={i} className="text-xs">
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                第{r.round}轮·{r.speakerName}：
              </span>
              <span className="text-gray-600 dark:text-gray-300">
                {r.stance}
              </span>
            </div>
          ))}
        </div>
      )}

      {conclusion && (
        <div className="border-t border-amber-200 dark:border-amber-800 pt-2">
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
            仲裁结论：
          </span>
          <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed mt-0.5">
            {conclusion}
          </p>
        </div>
      )}
    </div>
  );
}
