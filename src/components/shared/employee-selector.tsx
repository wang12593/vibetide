"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { EMPLOYEE_META, EMPLOYEE_SHORT_DESC, type EmployeeId } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import type { AIEmployee } from "@/lib/types";

const EMPLOYEE_ORDER = [
  "xiaolei", "xiaoce", "xiaozi", "xiaowen",
  "xiaoshen", "xiaofa", "xiaoshu", "xiaojian",
];

interface EmployeeSelectorProps {
  employees: AIEmployee[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  min?: number;
  max?: number;
}

export function EmployeeSelector({
  employees,
  selectedIds,
  onChange,
  min = 2,
  max = 6,
}: EmployeeSelectorProps) {
  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id));
    } else if (selectedIds.length < max) {
      onChange([...selectedIds, id]);
    }
  };

  const sorted = [...employees]
    .filter((e) => EMPLOYEE_ORDER.includes(e.id))
    .sort((a, b) => {
      const ia = EMPLOYEE_ORDER.indexOf(a.id);
      const ib = EMPLOYEE_ORDER.indexOf(b.id);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {sorted.map((emp) => {
          const isSelected = selectedIds.includes(emp.id);
          const meta = EMPLOYEE_META[emp.id as EmployeeId];
          const displayTitle = meta?.name ?? emp.name ?? emp.title;
          const displaySubtitle = EMPLOYEE_SHORT_DESC[emp.id as EmployeeId] ?? "";
          return (
            <button
              key={emp.id}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-200 border-0",
                isSelected
                  ? "bg-blue-50/80 dark:bg-blue-900/20 ring-1 ring-blue-300/50"
                  : "bg-white/40 dark:bg-gray-800/40 hover:bg-white/70 dark:hover:bg-gray-800/60"
              )}
              onClick={() => toggle(emp.id)}
            >
              <EmployeeAvatar employeeId={emp.id} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  {displayTitle}
                </p>
                <p className="text-[11px] text-gray-400 truncate">
                  {displaySubtitle}
                </p>
              </div>
              {isSelected && (
                <Check size={14} className="text-blue-500 flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-400 text-center">
        已选 {selectedIds.length} / {max} 人（最少 {min} 人）
      </p>
    </div>
  );
}
