"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  category?: string;
}

interface CommandPopoverProps {
  items: CommandItem[];
  visible: boolean;
  onSelect: (item: CommandItem) => void;
  onClose: () => void;
  filterText?: string;
  title?: string;
}

export function CommandPopover({
  items,
  visible,
  onSelect,
  onClose,
  filterText = "",
  title,
}: CommandPopoverProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = items.filter((item) => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      (item.description?.toLowerCase().includes(q) ?? false) ||
      item.id.toLowerCase().includes(q) ||
      (item.category?.toLowerCase().includes(q) ?? false)
    );
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [filterText]);

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
        onSelect(filtered[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, filtered, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    if (!listRef.current || filtered.length === 0) return;
    const selected = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, filtered.length]);

  if (!visible || filtered.length === 0) {
    if (visible && filterText && items.length > 0) {
      return (
        <div className="absolute bottom-full left-4 right-4 mb-2 rounded-xl bg-white dark:bg-gray-900 shadow-lg border border-gray-200/60 dark:border-gray-700/60 z-50 p-3">
          <p className="text-xs text-gray-400 dark:text-gray-500">未找到匹配项</p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="absolute bottom-full left-4 right-4 mb-2 rounded-xl bg-white dark:bg-gray-900 shadow-lg border border-gray-200/60 dark:border-gray-700/60 z-50 overflow-hidden">
      {title && (
        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-400 dark:text-gray-500">{title}</p>
        </div>
      )}
      <div ref={listRef} className="max-h-[240px] overflow-y-auto p-1">
        {filtered.map((item, i) => (
          <button
            key={item.id}
            className={cn(
              "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all border-0 cursor-pointer",
              i === selectedIndex
                ? "bg-blue-50 dark:bg-blue-900/20"
                : "bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50"
            )}
            onClick={() => onSelect(item)}
            onMouseEnter={() => setSelectedIndex(i)}
          >
            {item.icon && (
              <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-400 dark:text-gray-500">
                {item.icon}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                {item.label}
              </p>
              {item.description && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                  {item.description}
                </p>
              )}
            </div>
            {item.category && (
              <span className="text-[10px] text-gray-300 dark:text-gray-600 flex-shrink-0">
                {item.category}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
