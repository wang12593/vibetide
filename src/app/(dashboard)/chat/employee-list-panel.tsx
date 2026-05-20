"use client";

import { useState, useMemo } from "react";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { EMPLOYEE_META, EMPLOYEE_SHORT_DESC, type EmployeeId } from "@/lib/constants";
import { Search, Trash2, MessageSquare, Bookmark, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { AIEmployee } from "@/lib/types";
import type { SavedConversationRow } from "@/db/types";

const statusLabel: Record<string, string> = {
  working: "工作中",
  idle: "空闲",
  learning: "学习中",
  reviewing: "审核中",
};

const statusDot: Record<string, string> = {
  working: "bg-green-500",
  idle: "bg-gray-400",
  learning: "bg-blue-500",
  reviewing: "bg-amber-500",
};

interface EmployeeListPanelProps {
  employees: AIEmployee[];
  savedConversations: SavedConversationRow[];
  groupConversations: SavedConversationRow[];
  selectedSlug: string;
  activeTab: "employees" | "groups" | "saved";
  unreadCounts: Record<string, number>;
  onSelectEmployee: (slug: string) => void;
  onSelectSaved: (conversation: SavedConversationRow) => void;
  onSelectGroup: (conversation: SavedConversationRow) => void;
  onTabChange: (tab: "employees" | "groups" | "saved") => void;
  onDeleteSaved: (id: string) => void;
  onDeleteGroupChat: (id: string) => void;
  onCreateGroup: () => void;
}

function formatRelativeTime(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  const months = Math.floor(days / 30);
  return `${months}个月前`;
}

export function EmployeeListPanel({
  employees,
  savedConversations,
  groupConversations,
  selectedSlug,
  activeTab,
  unreadCounts,
  onSelectEmployee,
  onSelectSaved,
  onSelectGroup,
  onTabChange,
  onDeleteSaved,
  onDeleteGroupChat,
  onCreateGroup,
}: EmployeeListPanelProps) {
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: "saved" | "group" } | null>(null);

  const EMPLOYEE_ORDER = [
    "leader",
    "xiaolei", "xiaoce", "xiaozi", "xiaowen",
    "xiaoshen", "xiaofa", "xiaoshu", "xiaojian",
    "xiaotan", "xiaoling",
  ];

  const filteredEmployees = useMemo(() => {
    const sorted = [...employees].sort((a, b) => {
      const ia = EMPLOYEE_ORDER.indexOf(a.id);
      const ib = EMPLOYEE_ORDER.indexOf(b.id);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.nickname.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q)
    );
  }, [employees, search]);

  const filteredSaved = useMemo(() => {
    if (!search.trim()) return savedConversations;
    const q = search.toLowerCase();
    return savedConversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.employeeSlug ?? "").toLowerCase().includes(q)
    );
  }, [savedConversations, search]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groupConversations;
    const q = search.toLowerCase();
    return groupConversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [groupConversations, search]);

  return (
    <div className="w-[280px] flex flex-col min-h-0 border-r border-gray-300/60 dark:border-gray-600/60 bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm">
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="搜索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-8 pr-3 rounded-lg bg-white/60 dark:bg-gray-800/60 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:ring-1 focus:ring-blue-400/50 transition-all border-0"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-3 pb-2 flex gap-1 items-center">
        <button
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border-0",
            activeTab === "employees"
              ? "bg-blue-500 text-white shadow-sm"
              : "bg-white/50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-gray-700/60"
          )}
          onClick={() => onTabChange("employees")}
        >
          <MessageSquare size={12} />
          数字员工
        </button>
        <button
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border-0",
            activeTab === "groups"
              ? "bg-blue-500 text-white shadow-sm"
              : "bg-white/50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-gray-700/60"
          )}
          onClick={() => onTabChange("groups")}
        >
          <Users size={12} />
          群聊
          {groupConversations.length > 0 && (
            <span className="ml-0.5 text-[10px] opacity-70">
              {groupConversations.length}
            </span>
          )}
        </button>
        <button
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border-0",
            activeTab === "saved"
              ? "bg-blue-500 text-white shadow-sm"
              : "bg-white/50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-gray-700/60"
          )}
          onClick={() => onTabChange("saved")}
        >
          <Bookmark size={12} />
          收藏
          {savedConversations.length > 0 && (
            <span className="ml-0.5 text-[10px] opacity-70">
              {savedConversations.length}
            </span>
          )}
        </button>
        {activeTab === "groups" && (
          <button
            className="ml-auto flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-all border-0"
            onClick={onCreateGroup}
            title="发起群聊"
          >
            <Users size={14} />
          </button>
        )}
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {activeTab === "employees" ? (
          /* Employee list */
          <div className="space-y-1">
            {filteredEmployees.map((emp) => {
              const meta = EMPLOYEE_META[emp.id as EmployeeId];
              const isSelected = emp.id === selectedSlug;
              const displayTitle = meta?.name ?? emp.title;
              const displaySubtitle = EMPLOYEE_SHORT_DESC[emp.id as EmployeeId] ?? "";
              return (
                <button
                  key={emp.id}
                  className={cn(
                    "group w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-300 ease-out border-0",
                    isSelected
                      ? "bg-blue-50/80 dark:bg-blue-900/20 shadow-[0_2px_12px_rgba(59,130,246,0.12)]"
                      : "bg-transparent hover:bg-white/60 dark:hover:bg-gray-800/50 hover:translate-x-1 hover:shadow-[0_2px_10px_rgba(59,130,246,0.08)]"
                  )}
                  onClick={() => onSelectEmployee(emp.id)}
                >
                  <div className="transition-transform duration-300 ease-out group-hover:scale-110 group-hover:rotate-[-4deg]">
                    <EmployeeAvatar
                      employeeId={emp.id}
                      size="sm"
                      showStatus
                      status={emp.status}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "text-sm font-medium truncate",
                          isSelected
                            ? "text-blue-700 dark:text-blue-300"
                            : "text-gray-800 dark:text-gray-200"
                        )}
                      >
                        {displayTitle}
                      </span>
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full flex-shrink-0",
                          isSelected
                            ? "bg-green-400 shadow-[0_0_6px_2px_rgba(74,222,128,0.6)] animate-[dot-pulse_2s_ease-in-out_infinite]"
                            : statusDot[emp.status] || "bg-gray-400"
                        )}
                      />
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {displaySubtitle}
                    </p>
                  </div>
                  {unreadCounts[emp.id] > 0 && !isSelected && (
                    <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                      {unreadCounts[emp.id] > 99 ? "99+" : unreadCounts[emp.id]}
                    </span>
                  )}
                  {isSelected && (
                    <div
                      className="w-1 h-6 rounded-full flex-shrink-0"
                      style={{ backgroundColor: meta?.color ?? "#3b82f6" }}
                    />
                  )}
                </button>
              );
            })}
            {filteredEmployees.length === 0 && (
              <div className="py-8 text-center text-xs text-gray-400">
                未找到匹配的数字员工
              </div>
            )}
          </div>
        ) : activeTab === "groups" ? (
          /* Group conversations list */
          <div className="space-y-1">
            {filteredGroups.map((conv) => {
              const meta = conv.metadata as Record<string, unknown> | null;
              const slugs = (meta?.employeeSlugs as string[]) ?? [];
              const memberCount = slugs.length;
              return (
                <div
                  key={conv.id}
                  className="group flex items-center gap-2.5 px-3 py-3 rounded-xl cursor-pointer hover:bg-white/60 dark:hover:bg-gray-800/50 hover:translate-x-1 hover:shadow-[0_2px_10px_rgba(59,130,246,0.08)] transition-all duration-300 ease-out"
                  onClick={() => onSelectGroup(conv)}
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100/80 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <Users size={14} className="text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                      {conv.title}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {memberCount}人 · {formatRelativeTime(conv.updatedAt)}
                    </p>
                  </div>
                  <button
                    className="flex-shrink-0 opacity-40 hover:opacity-100 w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 border-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({ id: conv.id, type: "group" });
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
            {filteredGroups.length === 0 && (
              <div className="py-8 text-center text-xs text-gray-400">
                {search ? "未找到匹配的群聊" : "暂无群聊，点击右上角发起"}
              </div>
            )}
          </div>
        ) : (
          /* Saved conversations list */
          <div className="space-y-1">
            {filteredSaved.map((conv) => (
              <div
                key={conv.id}
                className="group flex items-center gap-2.5 px-3 py-3 rounded-xl cursor-pointer hover:bg-white/60 dark:hover:bg-gray-800/50 hover:translate-x-1 hover:shadow-[0_2px_10px_rgba(59,130,246,0.08)] transition-all duration-300 ease-out"
                onClick={() => onSelectSaved(conv)}
              >
                <EmployeeAvatar
                  employeeId={conv.employeeSlug ?? ""}
                  size="xs"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                    {conv.title}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {formatRelativeTime(conv.createdAt)}
                  </p>
                </div>
                <button
                  className="flex-shrink-0 opacity-40 hover:opacity-100 w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 border-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget({ id: conv.id, type: "saved" });
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {filteredSaved.length === 0 && (
              <div className="py-8 text-center text-xs text-gray-400">
                {search ? "未找到匹配的收藏" : "暂无收藏对话"}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="确认删除"
        description={deleteTarget?.type === "group" ? "删除后群聊记录将无法恢复，确认删除？" : "删除后对话记录将无法恢复，确认删除？"}
        confirmText="删除"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget?.type === "group") {
            onDeleteGroupChat(deleteTarget.id);
          } else if (deleteTarget?.type === "saved") {
            onDeleteSaved(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
