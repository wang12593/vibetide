"use client";

import { cn } from "@/lib/utils";
import { Lock, Globe } from "lucide-react";

interface VisibilityBadgeProps {
  visibility: "personal" | "org" | null | undefined;
  className?: string;
  size?: "sm" | "xs";
}

export function VisibilityBadge({ visibility, className, size = "sm" }: VisibilityBadgeProps) {
  if (!visibility) return null;

  const isPersonal = visibility === "personal";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        isPersonal
          ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
          : "bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400",
        className
      )}
    >
      {isPersonal ? <Lock size={10} /> : <Globe size={10} />}
      {isPersonal ? "个人" : "组织"}
    </span>
  );
}
