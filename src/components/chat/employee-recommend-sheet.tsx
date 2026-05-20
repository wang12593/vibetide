"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { Sparkles, MessageSquare, ArrowRight, Lightbulb, Loader2 } from "lucide-react";

interface EmployeeRecommendSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    slug: string;
    name: string;
    title: string;
    skills: string[];
  };
  taskUnderstanding: {
    topic: string;
    type: string;
    description: string;
  };
  suggestions?: string[];
  onStartChat: () => void;
  loading?: boolean;
}

export function EmployeeRecommendSheet({
  open,
  onOpenChange,
  employee,
  taskUnderstanding,
  suggestions = [],
  onStartChat,
  loading = false,
}: EmployeeRecommendSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="sr-only">员工推荐</SheetTitle>
          <SheetDescription className="sr-only">
            AI 员工推荐信息与任务理解摘要
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 mt-2">
          <div className="flex items-center gap-4 rounded-xl bg-white/60 dark:bg-white/5 p-4">
            <EmployeeAvatar employeeId={employee.slug} size="xl" />
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground text-base">
                  {employee.name}
                </span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground truncate">
                  {employee.title}
                </span>
              </div>
              {employee.skills.length > 0 && (
                <p className="text-xs text-muted-foreground truncate">
                  擅长：{employee.skills.slice(0, 4).join("、")}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                技能：{employee.skills.length} 个
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Sparkles size={14} className="text-amber-500" />
              <span>本次任务理解</span>
            </div>
            <div className="rounded-xl bg-white/60 dark:bg-white/5 p-4 flex flex-col gap-2.5">
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground shrink-0 w-10">
                  主题
                </span>
                <span className="text-sm text-foreground">
                  {taskUnderstanding.topic}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground shrink-0 w-10">
                  类型
                </span>
                <span className="text-sm text-foreground">
                  {taskUnderstanding.type}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground shrink-0 w-10">
                  描述
                </span>
                <span className="text-sm text-foreground leading-relaxed">
                  {taskUnderstanding.description}
                </span>
              </div>
            </div>
          </div>

          {suggestions.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Lightbulb size={14} className="text-sky-500" />
                <span>你可以这样补充</span>
              </div>
              <ul className="flex flex-col gap-2">
                {suggestions.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span className="shrink-0 mt-1 w-1 h-1 rounded-full bg-muted-foreground/40" />
                    <span className="leading-relaxed">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-2 pb-4">
            <Button
              className="w-full"
              size="lg"
              onClick={onStartChat}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>连接中...</span>
                </>
              ) : (
                <>
                  <MessageSquare size={16} />
                  <span>开始对话</span>
                  <ArrowRight size={14} />
                </>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
