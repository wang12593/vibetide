"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Crown,
  FileText,
  Search,
  Filter,
} from "lucide-react";

interface MulanMissionsClientProps {
  missions: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    progress: number | null;
  }>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: "已完成", color: "text-emerald-600", bg: "bg-emerald-500/10" },
  failed: { label: "失败", color: "text-red-500", bg: "bg-red-500/10" },
  executing: { label: "执行中", color: "text-blue-600", bg: "bg-blue-500/10" },
  planning: { label: "规划中", color: "text-amber-600", bg: "bg-amber-500/10" },
  consolidating: { label: "汇总中", color: "text-purple-600", bg: "bg-purple-500/10" },
  queued: { label: "排队中", color: "text-gray-500", bg: "bg-gray-500/10" },
  cancelled: { label: "已取消", color: "text-gray-400", bg: "bg-gray-500/10" },
};

type StatusFilter = "all" | "active" | "completed" | "failed";

export function MulanMissionsClient({ missions }: MulanMissionsClientProps) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const filtered = missions.filter((m) => {
    if (filter === "active" && !["executing", "planning", "consolidating", "queued"].includes(m.status)) return false;
    if (filter === "completed" && m.status !== "completed") return false;
    if (filter === "failed" && m.status !== "failed") return false;
    if (search && !m.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all: missions.length,
    active: missions.filter((m) => ["executing", "planning", "consolidating", "queued"].includes(m.status)).length,
    completed: missions.filter((m) => m.status === "completed").length,
    failed: missions.filter((m) => m.status === "failed").length,
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border/30 shrink-0">
        <Crown size={20} className="text-rose-500" />
        <h1 className="text-lg font-semibold">穆兰的任务</h1>
      </div>

      <div className="px-6 py-3 flex items-center gap-3 shrink-0">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索任务..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted/30 text-sm outline-none focus:bg-muted/50 transition-colors"
          />
        </div>
        <div className="flex gap-1 p-0.5 rounded-xl bg-muted/30">
          {([
            { key: "all" as StatusFilter, label: "全部" },
            { key: "active" as StatusFilter, label: "进行中" },
            { key: "completed" as StatusFilter, label: "已完成" },
            { key: "failed" as StatusFilter, label: "失败" },
          ]).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer bg-transparent",
                filter === f.key
                  ? "bg-white dark:bg-white/10 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
              <span className="ml-1 text-[10px] text-muted-foreground">{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 pb-6">
        {filtered.length > 0 ? (
          <div className="space-y-2 mt-2">
            {filtered.map((m) => {
              const cfg = STATUS_CONFIG[m.status] ?? { label: m.status, color: "text-gray-400", bg: "bg-gray-500/10" };
              return (
                <a
                  key={m.id}
                  href={`/missions/${m.id}`}
                  className="block px-4 py-3 rounded-xl bg-white/60 dark:bg-white/[0.04] hover:bg-white/80 dark:hover:bg-white/[0.07] transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium truncate mr-3">{m.title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {m.progress != null && !["completed", "failed"].includes(m.status) && (
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-all"
                            style={{ width: `${m.progress}%` }}
                          />
                        </div>
                      )}
                      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", cfg.bg, cfg.color)}>
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <FileText size={11} />
                    <span>{new Date(m.createdAt).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}</span>
                    {m.progress != null && <span>· {m.progress}%</span>}
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {search ? "未找到匹配的任务" : "暂无任务记录"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
