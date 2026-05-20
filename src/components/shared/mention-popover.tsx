"use client";

import { useState, useEffect, useRef } from "react";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { EMPLOYEE_META, EMPLOYEE_SHORT_DESC, type EmployeeId } from "@/lib/constants";
import type { AIEmployee } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MentionPopoverProps {
  employees: AIEmployee[];
  visible: boolean;
  onSelect: (employeeId: string, employeeName: string) => void;
  onClose: () => void;
  filter?: string;
  position?: { top: number; left: number };
}

export function MentionPopover({
  employees,
  visible,
  onSelect,
  onClose,
  filter = "",
}: MentionPopoverProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = employees.filter((emp) => {
    const meta = EMPLOYEE_META[emp.id as EmployeeId];
    const name = meta?.name ?? emp.name ?? emp.title;
    return filter ? name.includes(filter) || emp.id.includes(filter.toLowerCase()) : true;
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  useEffect(() => {
    if (!visible) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        const emp = filtered[selectedIndex];
        const meta = EMPLOYEE_META[emp.id as EmployeeId];
        onSelect(emp.id, meta?.name ?? emp.name ?? emp.title);
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, filtered, selectedIndex, onSelect, onClose]);

  if (!visible || filtered.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-4 mb-2 w-56 max-h-48 overflow-y-auto rounded-xl bg-white dark:bg-gray-900 shadow-lg border border-gray-200/60 dark:border-gray-700/60 z-50"
    >
      <div className="p-1.5">
        {filtered.map((emp, i) => {
          const meta = EMPLOYEE_META[emp.id as EmployeeId];
          const name = meta?.name ?? emp.name ?? emp.title;
          const subtitle = EMPLOYEE_SHORT_DESC[emp.id as EmployeeId] ?? "";
          return (
            <button
              key={emp.id}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all border-0",
                i === selectedIndex
                  ? "bg-blue-50 dark:bg-blue-900/20"
                  : "bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50"
              )}
              onClick={() => onSelect(emp.id, name)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <EmployeeAvatar employeeId={emp.id} size="xs" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                  {name}
                </p>
                <p className="text-[10px] text-gray-400 truncate">{subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
