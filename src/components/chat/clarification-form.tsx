"use client";

/**
 * @deprecated Use MultiTurnClarifyBubble from intent-bubble.tsx instead.
 * Kept for feature flag rollback (VIBETIDE_MULTI_TURN_CLARIFY_ENABLED=false).
 */

import { useState } from "react";
import type { IntentResult } from "@/lib/agent/types";

interface ClarificationFormProps {
  intent: IntentResult;
  onSubmit: (answers: Record<string, string>) => void;
  onCancel: () => void;
}

export default function ClarificationForm({
  intent,
  onSubmit,
  onCancel,
}: ClarificationFormProps) {
  const questions = intent.clarificationQuestions ?? [];
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleChange = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const anyFilled = questions.some(
    (q) => answers[q.id]?.trim().length > 0
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(answers);
  };

  const handleSkip = () => {
    onSubmit(answers);
  };

  const inputCls =
    "w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white/90 outline-none focus:border-blue-400 focus:dark:border-blue-400/50 transition placeholder:text-gray-400 dark:placeholder:text-white/30";

  return (
    <div className="mx-auto max-w-2xl px-4 pb-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900/80 backdrop-blur-md p-5 space-y-4 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">📋</span>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">
            匹配到场景「{intent.workflowName || "协作任务"}」，请补充以下信息
          </h3>
        </div>

        <p className="text-xs text-gray-400 dark:text-white/40 -mt-2">
          填写越多信息，生成质量越高。所有字段均可选，也可直接跳过。
        </p>

        <div className="space-y-3">
          {questions.map((q) => (
            <div key={q.id}>
              <label className="block text-xs font-medium text-gray-600 dark:text-white/60 mb-1">
                {q.question}
              </label>
              {q.inputType === "select" && q.options?.length ? (
                <select
                  value={answers[q.id] || ""}
                  onChange={(e) => handleChange(q.id, e.target.value)}
                  className={inputCls}
                >
                  <option value="">
                    {q.placeholder || "请选择（可选）"}
                  </option>
                  {q.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : q.inputType === "textarea" ? (
                <textarea
                  value={answers[q.id] || ""}
                  onChange={(e) => handleChange(q.id, e.target.value)}
                  placeholder={q.placeholder || "（可选）"}
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              ) : (
                <input
                  type={q.inputType === "number" ? "number" : "text"}
                  value={answers[q.id] || ""}
                  onChange={(e) => handleChange(q.id, e.target.value)}
                  placeholder={q.placeholder || "（可选）"}
                  className={inputCls}
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs text-gray-500 dark:text-white/50 hover:text-gray-800 dark:hover:text-white/80 hover:bg-gray-100 dark:hover:bg-white/5 transition"
          >
            取消
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSkip}
              className="px-4 py-2 rounded-lg text-xs text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/70 hover:bg-gray-100 dark:hover:bg-white/5 transition"
            >
              跳过，直接执行
            </button>
            <button
              type="submit"
              disabled={!anyFilled}
              className="px-5 py-2 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              确认并执行
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
