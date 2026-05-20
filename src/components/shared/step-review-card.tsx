"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check, Edit3, RefreshCw, Eye } from "lucide-react";
import { useState } from "react";

interface StepReviewCardProps {
  employeeName: string;
  employeeSlug: string;
  outputPreview: string;
  isLastStep?: boolean;
  canOperate?: boolean;
  onApprove?: () => void;
  onRequestEdit?: () => void;
  onRequestRewrite?: () => void;
  onViewFull?: () => void;
  className?: string;
}

export function StepReviewCard({
  employeeName,
  outputPreview,
  isLastStep,
  canOperate = true,
  onApprove,
  onRequestEdit,
  onRequestRewrite,
  onViewFull,
  className,
}: StepReviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const previewText = outputPreview.length > 300 && !expanded
    ? outputPreview.slice(0, 300) + "..."
    : outputPreview;

  return (
    <div
      className={cn(
        "rounded-xl border border-blue-200/60 dark:border-blue-800/40 bg-blue-50/40 dark:bg-blue-900/10 p-4 space-y-3",
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <span className="font-medium text-blue-700 dark:text-blue-300">
          {employeeName}
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          {isLastStep ? "提交了最终成果" : "提交了步骤产出"}
        </span>
      </div>

      <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
        {previewText}
      </div>

      {outputPreview.length > 300 && (
        <button
          className="text-xs text-blue-500 hover:text-blue-600 transition-colors border-0 bg-transparent p-0"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "收起" : "展开全文"}
        </button>
      )}

      {canOperate ? (
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
            onClick={onApprove}
          >
            <Check size={12} />
            {isLastStep ? "确认完成" : "确认通过"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
            onClick={onRequestEdit}
          >
            <Edit3 size={12} />
            修改建议
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-gray-500 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/40"
            onClick={onRequestRewrite}
          >
            <RefreshCw size={12} />
            重写
          </Button>
        </div>
      ) : (
        <p className="text-xs text-gray-400 pt-1">
          等待确认...
        </p>
      )}
    </div>
  );
}
