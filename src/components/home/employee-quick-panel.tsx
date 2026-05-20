"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { cn } from "@/lib/utils";

const DISPLAY_EMPLOYEES: EmployeeId[] = [
  "xiaolei",
  "xiaoce",
  "xiaozi",
  "xiaowen",
  "xiaojian",
  "xiaoshen",
  "xiaofa",
  "xiaoshu",
];

interface EmployeeQuickPanelProps {
  activeEmployee?: EmployeeId | null;
  onEmployeeClick: (id: EmployeeId) => void;
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};

export function EmployeeQuickPanel({
  activeEmployee,
  onEmployeeClick,
}: EmployeeQuickPanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-1 py-1.5 rounded-lg hover:bg-muted/40 transition-colors cursor-pointer border-0 bg-transparent"
      >
        <span className="text-xs font-medium text-muted-foreground">
          AI 专家团队{activeEmployee ? ` · 已选 ${EMPLOYEE_META[activeEmployee]?.title ?? ""}` : ""}
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/ai-employees/create"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors duration-200"
          >
            <Plus size={14} />
            创建
          </Link>
          {expanded ? (
            <ChevronUp size={14} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={14} className="text-muted-foreground" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <motion.div
              className="flex flex-wrap justify-center gap-3 pb-2 pt-1"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {DISPLAY_EMPLOYEES.map((id) => {
                const emp = EMPLOYEE_META[id];
                const isActive = activeEmployee === id;

                return (
                  <motion.button
                    key={id}
                    variants={cardVariants}
                    onClick={() => {
                      onEmployeeClick(id);
                      setExpanded(false);
                    }}
                    whileHover={{ y: -1 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className={cn(
                      "flex-shrink-0 w-[88px] flex flex-col items-center gap-2 py-3 px-2 rounded-xl",
                      "cursor-pointer transition-colors duration-200 border-0",
                      isActive
                        ? "bg-accent"
                        : "bg-transparent hover:bg-muted/50"
                    )}
                  >
                    <EmployeeAvatar employeeId={id} size="lg" animated />
                    <span
                      className={cn(
                        "text-[11px] text-center leading-tight",
                        isActive ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {emp.title}
                    </span>
                  </motion.button>
                );
              })}
            </motion.div>

            <div className="flex justify-center pb-1">
              <Link
                href="/ai-employees"
                className="text-xs text-muted-foreground/70 hover:text-foreground transition-colors duration-200"
              >
                全部数字员工 →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
