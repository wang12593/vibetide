"use client";

import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, SkipForward } from "lucide-react";

interface ClarificationCardProps {
  question: string;
  parameters: Record<string, string>;
  totalRequired: number;
  collectedCount: number;
  onSkip: () => void;
}

const PARAMETER_LABELS: Record<string, string> = {
  topic: "主题",
  angle: "角度",
  platform: "平台",
  style: "风格",
  audience: "受众",
  length: "篇幅",
  tone: "语调",
  format: "格式",
  category: "分类",
  source: "来源",
  keyword: "关键词",
  timeframe: "时间范围",
};

export function ClarificationCard({
  question,
  parameters,
  totalRequired,
  collectedCount,
  onSkip,
}: ClarificationCardProps) {
  const collectedEntries = Object.entries(parameters).filter(([, v]) => v);

  return (
    <GlassCard variant="interactive" padding="md" className="max-w-md">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <Sparkles size={14} className="text-blue-500" />
        </div>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          需求确认
        </span>
      </div>

      {question && (
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
          {question}
        </p>
      )}

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            参数收集进度
          </span>
          <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
            {collectedCount}/{totalRequired}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700/50 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${totalRequired > 0 ? (collectedCount / totalRequired) * 100 : 0}%` }}
          />
        </div>
      </div>

      {collectedEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {collectedEntries.map(([key, value]) => (
            <Badge
              key={key}
              variant="secondary"
              className="text-[11px] px-2 py-0.5"
            >
              {PARAMETER_LABELS[key] ?? key}：{value}
            </Badge>
          ))}
        </div>
      )}

      <div className="pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
        <Button
          variant="ghost"
          size="sm"
          className="w-full gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          onClick={onSkip}
        >
          <SkipForward size={14} />
          跳过确认，直接开始
        </Button>
      </div>
    </GlassCard>
  );
}
