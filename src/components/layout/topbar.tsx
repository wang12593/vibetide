"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Search, Bell, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
// SidebarTrigger removed — sidebar has its own expand/collapse toggle
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/actions/auth";
import { ThemeSwitcher } from "@/components/theme-switcher";

const pageTitles: Record<string, string> = {
  "/missions": "任务中心",
  "/channel-advisor": "频道顾问",
  "/inspiration": "热点发现",
  "/topic-compare": "同题对比",
  "/missing-topics": "漏题筛查",
  "/topic-compare/accounts": "我方账号",
  "/benchmark-accounts": "对标账号库",
  "/super-creation": "超级创作",
  "/premium-content": "精品聚合",
  "/video-batch": "短视频工厂",
  "/event-auto": "节赛会展",
  "/publishing": "全渠道发布",
  "/analytics": "数据分析",
  "/employee-marketplace": "数字员工市场",
  // 智能媒资
  "/asset-intelligence": "媒资智能理解",
  "/channel-knowledge": "频道知识库",
  "/asset-revive": "资产盘活中心",
  // legacy
  "/hot-topics": "热点看板",
  "/creation": "创作中心",
  "/competitive": "竞品对标",
  // 系统管理
  "/admin/organizations": "组织管理",
  "/admin/users": "用户管理",
  "/admin/roles": "角色权限",
};

const pageGroups: Record<string, string> = {
  "/missions": "工作空间",
  "/channel-advisor": "工作空间",
  "/employee-marketplace": "工作空间",
  "/inspiration": "创作者中心",
  "/topic-compare": "创作者中心",
  "/missing-topics": "创作者中心",
  "/benchmark-accounts": "创作者中心",
  "/super-creation": "创作者中心",
  "/premium-content": "创作者中心",
  "/video-batch": "创作者中心",
  "/event-auto": "创作者中心",
  "/asset-intelligence": "智能媒资",
  "/channel-knowledge": "智能媒资",
  "/asset-revive": "智能媒资",
  "/publishing": "运营分析",
  "/analytics": "运营分析",
  "/admin/organizations": "系统管理",
  "/admin/users": "系统管理",
  "/admin/roles": "系统管理",
};

interface TopbarProps {
  userName: string;
  unreadCount?: number;
}

export function Topbar({ userName, unreadCount = 0 }: TopbarProps) {
  const pathname = usePathname();
  const pageTitle = pageTitles[pathname] || "工作台";
  const groupName = pageGroups[pathname];

  return (
    <header
      className="h-14 flex items-center px-4 gap-4 sticky top-0 z-30"
      style={{
        background: "#D43D3D",
      }}
    >
      <Link href="/home" className="shrink-0 flex items-center gap-2">
        <img
          src="/logo.png"
          alt="军媒智云"
          className="h-7 w-auto object-contain"
        />
      </Link>

      <div className="w-px h-6 bg-white/20" />

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              href="/missions"
              className="text-white/70 text-sm hover:text-white"
            >
              智能协作空间
            </BreadcrumbLink>
          </BreadcrumbItem>
          {groupName && (
            <>
              <BreadcrumbSeparator className="text-white/40" />
              <BreadcrumbItem>
                <span className="text-sm text-white/70">
                  {groupName}
                </span>
              </BreadcrumbItem>
            </>
          )}
          <BreadcrumbSeparator className="text-white/40" />
          <BreadcrumbItem>
            <span className="text-sm font-medium text-white">
              {pageTitle}
            </span>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50"
          />
          <input
            type="text"
            placeholder="搜索..."
            className="h-8 w-48 rounded-lg bg-white/10 border border-white/15 pl-8 pr-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-colors"
          />
        </div>
        <ThemeSwitcher />
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 relative text-white/70 hover:text-white hover:bg-white/10">
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-yellow-500 text-white text-[10px] font-semibold px-1 leading-none shadow-sm">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-2 px-2 text-white/80 hover:text-white hover:bg-white/10">
              <div className="w-6 h-6 rounded-full flex items-center justify-center bg-white/20">
                <User size={12} className="text-white" />
              </div>
              <span className="text-sm">{userName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => signOut()}
              className="text-red-600 dark:text-red-400 cursor-pointer"
            >
              <LogOut size={14} className="mr-2" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
