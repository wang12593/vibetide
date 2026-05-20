"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { SearchInput } from "@/components/shared/search-input";
import { VisibilityBadge } from "@/components/shared/visibility-badge";
import { Button } from "@/components/ui/button";
import { upgradeContentVisibility } from "@/app/actions/content-visibility";
import { Database, Trash2, ArrowUpRight } from "lucide-react";

type ContentItem = {
  id: string;
  name: string;
  type: string;
  visibility: "personal" | "org";
  createdBy: string | null;
  createdAt: Date | null;
};

type ContentType = "all" | "employee" | "mission" | "knowledge_base" | "skill";

export function ContentManagementClient() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ContentType>("all");
  const [items] = useState<ContentItem[]>([]);
  const [loading] = useState(false);

  const typeLabels: Record<ContentType, string> = {
    all: "全部类型",
    employee: "AI 员工",
    mission: "任务",
    knowledge_base: "知识库",
    skill: "技能",
  };

  const handleUpgrade = async (type: string, id: string) => {
    try {
      await upgradeContentVisibility(type as "employee" | "mission" | "knowledge_base" | "skill", id);
    } catch (err) {
      console.error("[content-mgmt] upgrade failed:", err);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="内容管理"
        description="管理所有用户创建的内容，查看可见性、升级为组织共享"
      />

      <GlassCard>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <SearchInput
              placeholder="搜索内容..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-60"
            />
            <div className="flex gap-1">
              {(Object.keys(typeLabels) as ContentType[]).map((t) => (
                <button
                  key={t}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-all border-0 bg-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  onClick={() => setTypeFilter(t)}
                >
                  {typeLabels[t]}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">加载中...</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center">
              <Database size={32} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-400">
                {search || typeFilter !== "all"
                  ? "未找到匹配的内容"
                  : "暂无内容数据"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                内容数据将在权限隔离启用后显示
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-400">{item.type}</p>
                  </div>
                  <VisibilityBadge visibility={item.visibility} size="xs" />
                  <div className="flex items-center gap-1">
                    {item.visibility === "personal" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 text-blue-500 hover:text-blue-600"
                        onClick={() => handleUpgrade(item.type, item.id)}
                      >
                        <ArrowUpRight size={12} />
                        升级
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
