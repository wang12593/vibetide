"use client";

import { cn } from "@/lib/utils";

type FilterMode = "all" | "own" | "org";

interface VisibilityFilterProps {
  value: FilterMode;
  onChange: (mode: FilterMode) => void;
  className?: string;
}

const OPTIONS: Array<{ value: FilterMode; label: string }> = [
  { value: "all", label: "全部" },
  { value: "own", label: "仅我的" },
  { value: "org", label: "组织共享" },
];

export function VisibilityFilter({ value, onChange, className }: VisibilityFilterProps) {
  return (
    <div className={cn("flex gap-1 rounded-lg bg-gray-100/60 dark:bg-gray-800/40 p-0.5", className)}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          className={cn(
            "px-3 py-1 rounded-md text-xs font-medium transition-all border-0",
            value === opt.value
              ? "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm"
              : "bg-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          )}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
