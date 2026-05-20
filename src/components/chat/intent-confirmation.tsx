"use client";

import { useState, useEffect } from "react";
import { ArrowRight, Check, X, UserPlus } from "lucide-react";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PipelineStep {
  employeeSlug: string;
  employeeName: string;
  taskDescription: string;
  skills: string[];
}

interface ClarificationQuestion {
  id: string;
  question: string;
  options: Array<{ label: string; value: string }>;
  allowCustom?: boolean;
  placeholder?: string;
}

interface IntentConfirmationProps {
  mode: "group" | "clarify";
  steps: PipelineStep[];
  clarificationQuestions?: ClarificationQuestion[];
  onConfirm: (data: {
    confirmedSteps: PipelineStep[];
    answers?: Record<string, string>;
  }) => void;
  onCancel: () => void;
  onSingleChat?: (step: PipelineStep) => void;
  onStayHere?: () => void;
  isExecuting?: boolean;
}

function StepNode({
  step,
  index,
  enabled,
  onToggle,
  totalSteps,
}: {
  step: PipelineStep;
  index: number;
  enabled: boolean;
  onToggle: () => void;
  totalSteps: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), index * 120);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <div
      className={cn(
        "flex items-center gap-2 transition-all duration-300",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "group relative flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200 border-0",
          enabled
            ? "bg-white/70 dark:bg-white/[0.06] shadow-sm hover:shadow-md"
            : "bg-gray-100/50 dark:bg-white/[0.02] opacity-50 hover:opacity-70 border border-dashed border-gray-300 dark:border-white/10"
        )}
      >
        <div className="relative">
          <EmployeeAvatar employeeId={step.employeeSlug} size="lg" />
          {enabled && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
              <Check size={10} className="text-white" />
            </span>
          )}
          {!enabled && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gray-400 dark:bg-gray-600 flex items-center justify-center">
              <X size={10} className="text-white" />
            </span>
          )}
        </div>
        <span
          className={cn(
            "text-xs font-medium whitespace-nowrap",
            enabled
              ? "text-gray-800 dark:text-white/90"
              : "text-gray-400 dark:text-white/30"
          )}
        >
          {step.employeeName}
        </span>
        <span
          className={cn(
            "text-[10px] text-center leading-tight max-w-[80px]",
            enabled
              ? "text-gray-500 dark:text-white/50"
              : "text-gray-300 dark:text-white/20"
          )}
        >
          {step.taskDescription}
        </span>
        {step.skills.length > 0 && (
          <div className="flex flex-wrap justify-center gap-0.5 mt-0.5">
            {step.skills.slice(0, 2).map((skill) => (
              <span
                key={skill}
                className={cn(
                  "text-[9px] px-1 py-0.5 rounded",
                  enabled
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400"
                    : "bg-gray-100 dark:bg-white/5 text-gray-300 dark:text-white/20"
                )}
              >
                {skill}
              </span>
            ))}
          </div>
        )}
        <span className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-gray-200 dark:bg-white/10 text-[10px] font-bold flex items-center justify-center text-gray-500 dark:text-white/40">
          {index + 1}
        </span>
      </button>

      {index < totalSteps - 1 && (
        <div
          className={cn(
            "flex-shrink-0 transition-all duration-300",
            visible ? "opacity-100" : "opacity-0"
          )}
        >
          <ArrowRight
            size={18}
            className="text-gray-300 dark:text-white/15"
          />
        </div>
      )}
    </div>
  );
}

function ClarifyMode({
  questions,
  onConfirm,
  onCancel,
}: {
  questions: ClarificationQuestion[];
  onConfirm: (answers: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleSelectOption = (qId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: prev[qId] === value ? "" : value,
    }));
  };

  const handleCustomInput = (qId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  };

  const handleSubmit = () => {
    onConfirm(answers);
  };

  const handleSkip = () => {
    onConfirm({});
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {questions.map((q, qi) => (
          <div
            key={q.id}
            className="animate-in fade-in slide-in-from-bottom-1 duration-300"
            style={{ animationDelay: `${qi * 80}ms` }}
          >
            <label className="block text-xs font-medium text-gray-600 dark:text-white/60 mb-2">
              {q.question}
            </label>

            {q.options.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {q.options.map((opt) => {
                  const selected = answers[q.id] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelectOption(q.id, opt.value)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs transition-all border-0",
                        selected
                          ? "bg-blue-500/15 text-blue-600 dark:bg-blue-400/20 dark:text-blue-400 font-medium"
                          : "bg-gray-100/80 dark:bg-white/[0.04] text-gray-500 dark:text-white/40 hover:bg-gray-200/80 dark:hover:bg-white/[0.08]"
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}

            {q.allowCustom && (
              <Input
                placeholder={q.placeholder || "自定义输入..."}
                value={answers[q.id] || ""}
                onChange={(e) => handleCustomInput(q.id, e.target.value)}
                className="text-xs h-8"
              />
            )}

            {q.options.length === 0 && !q.allowCustom && (
              <Input
                placeholder={q.placeholder || "请输入..."}
                value={answers[q.id] || ""}
                onChange={(e) => handleCustomInput(q.id, e.target.value)}
                className="text-xs h-8"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          取消
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            跳过
          </Button>
          <Button size="sm" onClick={handleSubmit}>
            <Check size={14} />
            确认
          </Button>
        </div>
      </div>
    </div>
  );
}

export function IntentConfirmation({
  mode,
  steps,
  clarificationQuestions,
  onConfirm,
  onCancel,
  onSingleChat,
  onStayHere,
  isExecuting,
}: IntentConfirmationProps) {
  const [enabledSteps, setEnabledSteps] = useState<Set<number>>(
    () => new Set(steps.map((_, i) => i))
  );

  const toggleStep = (index: number) => {
    setEnabledSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleGroupConfirm = () => {
    const confirmed = steps.filter((_, i) => enabledSteps.has(i));
    onConfirm({ confirmedSteps: confirmed });
  };

  const handleClarifyConfirm = (answers: Record<string, string>) => {
    onConfirm({ confirmedSteps: steps, answers });
  };

  return (
    <div className="w-full max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="rounded-2xl bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl p-5 shadow-lg ring-1 ring-inset ring-gray-200/50 dark:ring-white/[0.06]">
        {mode === "group" ? (
          <>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <UserPlus size={14} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">
                  多员工协作确认
                </h3>
                <p className="text-[11px] text-gray-400 dark:text-white/40">
                  我理解您需要多位员工协作完成这个任务，请确认执行流程
                </p>
              </div>
            </div>

            <div className="flex items-start gap-0 overflow-x-auto pb-3 px-2 scrollbar-thin">
              {steps.map((step, i) => (
                <StepNode
                  key={`${step.employeeSlug}-${i}`}
                  step={step}
                  index={i}
                  enabled={enabledSteps.has(i)}
                  onToggle={() => toggleStep(i)}
                  totalSteps={steps.length}
                />
              ))}
            </div>

            <p className="text-[10px] text-gray-400 dark:text-white/30 mb-4 text-center">
              点击节点可切换启用状态
            </p>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-white/[0.06]">
              <Button variant="ghost" size="sm" onClick={onCancel}>
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleGroupConfirm}
                disabled={enabledSteps.size === 0}
              >
                <Check size={14} />
                确认开始
              </Button>
            </div>
            {onSingleChat && steps.length > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[11px] text-gray-400">或：</span>
                {steps.map((s) => (
                  <button
                    key={s.employeeSlug}
                    onClick={() => onSingleChat(s)}
                    className="text-[11px] text-gray-400 hover:text-blue-500 transition-colors underline-offset-2 hover:underline"
                  >
                    {s.employeeName}
                  </button>
                )).reduce<React.ReactNode>((acc, cur, i) => {
                  if (i === 0) return cur;
                  return [acc, <span key={`sep-${i}`} className="text-[11px] text-gray-300">/</span>, cur];
                }, null)}
                <span className="text-[11px] text-gray-400">单独对话</span>
              </div>
            )}
            {onStayHere && (
              <div className="mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onStayHere}
                  disabled={isExecuting}
                  className="text-xs text-gray-400 hover:text-foreground w-full"
                >
                  {isExecuting ? "执行中..." : "🏠 就在这里完成"}
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <span className="text-sm">📋</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">
                  补充任务信息
                </h3>
                <p className="text-[11px] text-gray-400 dark:text-white/40">
                  填写以下信息可以帮助员工更精准地执行任务
                </p>
              </div>
            </div>

            <ClarifyMode
              questions={clarificationQuestions ?? []}
              onConfirm={handleClarifyConfirm}
              onCancel={onCancel}
            />
          </>
        )}
      </div>
    </div>
  );
}
