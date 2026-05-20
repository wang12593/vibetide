"use client";

import * as React from "react";
import { Cpu, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ModelOption {
  id: string;
  label: string;
  description: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: "Qwen3.5-35B-A3B",
    label: "Qwen 3.5-35B-A3B",
    description: "通义千问 · MoE 混合专家模型",
  },
];

export const DEFAULT_MODEL_ID = "Qwen3.5-35B-A3B";

export function getModelById(id: string | undefined): ModelOption {
  return (
    AVAILABLE_MODELS.find((m) => m.id === id) ?? AVAILABLE_MODELS[0]
  );
}

interface ModelSwitcherProps {
  value: string;
  onChange: (id: string) => void;
  size?: "sm" | "md";
  className?: string;
  align?: "start" | "center" | "end";
}

export function ModelSwitcher({
  value,
  onChange,
  size = "md",
  className,
  align = "start",
}: ModelSwitcherProps) {
  const [open, setOpen] = React.useState(false);
  const active = getModelById(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="切换模型"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border-0 bg-transparent transition-colors cursor-pointer",
            "text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08]",
            size === "sm" ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs",
            className,
          )}
        >
          <Cpu className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
          <span className="font-medium">{active.label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} sideOffset={8} className="w-56 p-1.5">
        <div className="space-y-0.5">
          {AVAILABLE_MODELS.map((m) => {
            const selected = m.id === value;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors border-0 bg-transparent cursor-pointer text-left",
                  selected
                    ? "bg-black/[0.05] dark:bg-white/[0.08] text-foreground"
                    : "text-muted-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.05]",
                )}
              >
                <div className="flex flex-col items-start min-w-0">
                  <span className="font-medium text-foreground">
                    {m.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {m.description}
                  </span>
                </div>
                {selected && (
                  <Check className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
