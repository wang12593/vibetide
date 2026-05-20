"use client";

import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowLeft } from "lucide-react";

interface ParameterConfirmationCardProps {
  parameters: Record<string, string>;
  parameterLabels: Record<string, string>;
  onConfirm: () => void;
  onModify: (field: string) => void;
}

export function ParameterConfirmationCard({
  parameters,
  parameterLabels,
  onConfirm,
  onModify,
}: ParameterConfirmationCardProps) {
  const entries = Object.entries(parameters).filter(([, v]) => v);

  return (
    <GlassCard variant="interactive" padding="md" className="max-w-md">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 size={14} className="text-emerald-500" />
        </div>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          需求确认
        </span>
      </div>

      <div className="space-y-2 mb-5">
        {entries.map(([key, value]) => (
          <button
            key={key}
            type="button"
            onClick={() => onModify(key)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors text-left border-0"
          >
            <div className="flex-1 min-w-0">
              <span className="text-[11px] text-gray-400 dark:text-gray-500 block mb-0.5">
                {parameterLabels[key] ?? key}
              </span>
              <span className="text-sm text-gray-800 dark:text-gray-200 truncate block">
                {value}
              </span>
            </div>
            <span className="text-[10px] text-blue-500 dark:text-blue-400 shrink-0 ml-2">
              修改
            </span>
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          className="flex-1 gap-2"
          onClick={onConfirm}
        >
          <CheckCircle2 size={14} />
          确认并开始
        </Button>
        <Button
          variant="ghost"
          className="gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          onClick={() => onModify(Object.keys(parameters)[0] ?? "")}
        >
          <ArrowLeft size={14} />
          返回修改
        </Button>
      </div>
    </GlassCard>
  );
}
