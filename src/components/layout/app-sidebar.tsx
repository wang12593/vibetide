"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Bot,
  Workflow,
  ListTodo,
  SearchX,
  PenLine,
  FolderOpen,
  BarChart3,
  MoreHorizontal,
  Settings,
  Bell,
  Lightbulb,
  PenTool,
  Gem,
  Film,
  FileStack,
  Radio,
  CalendarDays,
  Package,
  FileText,
  Brain as BrainIcon,
  BookMarked,
  Star,
  TrendingUp,
  Award,
  Building2,
  Users,
  Shield,
  CheckSquare,
  ShieldCheck,
  ChevronDown,
  Wrench,
  Telescope,
  Compass,
  Plus,
  Database,
  Crown,
  Clock,
  MessageSquare,
  Sparkles,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { MENU_PERMISSION_MAP } from "@/lib/rbac-constants";

/* ─── Optical size compensation ─────────────────────────────
   Lucide icons all use a 24×24 viewBox, but the drawn content
   varies in density. A few icons (Bot / ShieldCheck / Radio …)
   have inner padding, making them look smaller than siblings
   like Home / FolderOpen. This map bumps those up by 2px.
   ──────────────────────────────────────────────────────────── */
const OPTICAL_ICON_SIZE: Record<string, number> = {
  穆兰: 22,
  智能体: 22,
  审核: 22,
  渠道: 22,
  任务: 22,
  数据: 22,
};
function iconSizeFor(label: string, base = 20): number {
  return OPTICAL_ICON_SIZE[label] ?? base;
}

/* ─── Hover-controlled popover state hook ─── */
function useHoverPopover(delayClose = 120) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openNow = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOpen(true);
  };
  const closeSoon = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(false), delayClose);
  };
  return { open, setOpen, openNow, closeSoon };
}

/* ─── Types ─── */

interface SubItem { label: string; href: string; icon: LucideIcon }
interface NavItem extends SubItem { children?: SubItem[] }

/* ─── Navigation Data ─── */

const NAV_ITEMS: NavItem[] = [
  { label: "首页", href: "/home", icon: Home },
  { label: "对话", href: "/chat", icon: MessageSquare },
  { label: "任务", href: "/missions", icon: ListTodo },
  { label: "员工", href: "/ai-employees", icon: Users },
  { label: "技能", href: "/skills", icon: Wrench },
  { label: "场景", href: "/workflows", icon: Workflow },
  { label: "知识", href: "/knowledge-bases", icon: BookMarked },
];

const MORE_ITEMS: SubItem[] = [
  { label: "穆兰配置", href: "/settings/mulan-config", icon: Settings },
];

const ADMIN_ITEMS: SubItem[] = [
  { label: "用户管理", href: "/admin/users", icon: Users },
  { label: "角色权限", href: "/admin/roles", icon: Shield },
  { label: "组织管理", href: "/admin/organizations", icon: Building2 },
  { label: "内容管理", href: "/admin/content-management", icon: Database },
];

/* ─── Helpers ─── */

function isHrefActive(pathname: string, href: string) {
  if (href.startsWith("#")) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

function hasActiveChild(pathname: string, children?: SubItem[]) {
  return children?.some((c) => isHrefActive(pathname, c.href)) ?? false;
}

/* ─── Popover sub-menu (collapsed mode only) ─── */

function SubMenuList({ items, pathname }: { items: SubItem[]; pathname: string }) {
  return (
    <div className="space-y-0.5">
      {items.map((child) => {
        const ChildIcon = child.icon;
        const active = isHrefActive(pathname, child.href);
        return (
          <Link key={child.href} href={child.href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-150",
              active ? "nav-selected-sub font-medium"
                     : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}>
            <ChildIcon size={15} className="shrink-0" />
            <span>{child.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

/* ─── Settings button (hover popover when collapsed, click when expanded) ─── */

function SettingsButton({ pathname, expanded }: { pathname: string; expanded: boolean }) {
  const { open, setOpen, openNow, closeSoon } = useHoverPopover();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onMouseEnter={expanded ? undefined : openNow}
          onMouseLeave={expanded ? undefined : closeSoon}
          className={cn(
            "flex items-center rounded-xl transition-all duration-200 ease-out",
            "hover:-translate-y-0.5 active:translate-y-0",
            !expanded && "hover:rotate-[15deg] active:rotate-0",
            "border-0 bg-transparent cursor-pointer",
            "text-muted-foreground hover:bg-accent hover:text-foreground",
            expanded ? "gap-3 px-3 py-2 w-full" : "justify-center w-11 h-11"
          )}
        >
          <Settings size={20} strokeWidth={1.7} className="shrink-0" />
          {expanded && <span className="text-[13px] font-medium">设置</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={10}
        onMouseEnter={expanded ? undefined : openNow}
        onMouseLeave={expanded ? undefined : closeSoon}
        className="w-48 rounded-xl border border-border/60 bg-popover/95 backdrop-blur-xl p-1.5 shadow-[0_8px_32px_-8px_rgba(30,58,138,0.0),0_24px_64px_-24px_rgba(30,58,138,0.0),0_8px_32px_-8px_rgba(27,67,50,0.18),0_24px_64px_-24px_rgba(27,67,50,0.22)]"
      >
        <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/55">系统管理</p>
        <SubMenuList items={ADMIN_ITEMS} pathname={pathname} />
      </PopoverContent>
    </Popover>
  );
}

/* ─── "More" button (hover popover when collapsed, click when expanded) ─── */

function MoreButton({ items, pathname, expanded }: {
  items: SubItem[]; pathname: string; expanded: boolean;
}) {
  const { open, setOpen, openNow, closeSoon } = useHoverPopover();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onMouseEnter={expanded ? undefined : openNow}
          onMouseLeave={expanded ? undefined : closeSoon}
          className={cn(
            "flex items-center rounded-xl transition-all duration-200 ease-out",
            "hover:-translate-y-0.5 active:translate-y-0",
            !expanded && "hover:rotate-[15deg] active:rotate-0",
            "border-0 bg-transparent cursor-pointer",
            "text-muted-foreground hover:bg-accent hover:text-foreground",
            expanded
              ? "flex-row gap-3 px-3 py-2 w-full"
              : "justify-center w-11 h-11"
          )}
        >
          <MoreHorizontal size={20} strokeWidth={1.7} className="shrink-0" />
          {expanded && <span className="text-[13px] font-medium whitespace-nowrap">更多</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={10}
        onMouseEnter={expanded ? undefined : openNow}
        onMouseLeave={expanded ? undefined : closeSoon}
        className="w-48 rounded-xl border border-border/60 bg-popover/95 backdrop-blur-xl p-1.5 shadow-[0_8px_32px_-8px_rgba(30,58,138,0.18),0_24px_64px_-24px_rgba(30,58,138,0.22)]"
      >
        <SubMenuList items={items} pathname={pathname} />
      </PopoverContent>
    </Popover>
  );
}

/* ─── Hover-triggered collapsed nav group (icon + flyout submenu) ─── */

function HoverNavGroup({ item, active, children, pathname, Icon }: {
  item: NavItem;
  active: boolean;
  children: SubItem[];
  pathname: string;
  Icon: LucideIcon;
}) {
  const { open, setOpen, openNow, closeSoon } = useHoverPopover();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onMouseEnter={openNow}
          onMouseLeave={closeSoon}
          className={cn(
            "flex items-center justify-center w-11 h-11 rounded-xl",
            "transition-all duration-200 ease-out",
            "hover:-translate-y-0.5 hover:rotate-[15deg] active:translate-y-0 active:rotate-0",
            "border-0 bg-transparent cursor-pointer",
            active ? "nav-selected"
                   : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <Icon size={iconSizeFor(item.label)} strokeWidth={active ? 2 : 1.7} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={10}
        onMouseEnter={openNow}
        onMouseLeave={closeSoon}
        className="w-48 rounded-xl border border-border/60 bg-popover/95 backdrop-blur-xl p-1.5 shadow-[0_8px_32px_-8px_rgba(27,67,50,0.18),0_24px_64px_-24px_rgba(27,67,50,0.22)]"
      >
        <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/55">
          {item.label}
        </p>
        <SubMenuList items={children} pathname={pathname} />
      </PopoverContent>
    </Popover>
  );
}

/* ─── Unified Nav Item (adapts between collapsed/expanded via CSS) ─── */

function NavLink({ href, icon: Icon, label, active, expanded }: {
  href: string; icon: LucideIcon; label: string; active: boolean; expanded: boolean;
}) {
  const link = (
    <Link href={href}
      className={cn(
        "flex items-center rounded-xl transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 active:translate-y-0",
        !expanded && "hover:rotate-[15deg] active:rotate-0",
        active ? "nav-selected"
               : "text-muted-foreground hover:bg-accent hover:text-foreground",
        expanded
          ? "flex-row gap-3 px-3 py-2"
          : "justify-center w-11 h-11"
      )}>
      <Icon size={iconSizeFor(label)} strokeWidth={active ? 2 : 1.7} className="shrink-0" />
      {expanded && (
        <span className="text-[13px] font-medium whitespace-nowrap">{label}</span>
      )}
    </Link>
  );

  if (expanded) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className="px-2.5 py-1 text-[11px] font-medium">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/* ─── Unified Nav Group (collapsed=popover, expanded=inline children) ─── */

function NavGroup({ item, pathname, canSeeItem, expanded }: {
  item: NavItem; pathname: string; canSeeItem: (h: string) => boolean; expanded: boolean;
}) {
  const children = item.children?.filter((c) => canSeeItem(c.href)) ?? [];
  if (!children.length) return null;
  const Icon = item.icon;
  const active = hasActiveChild(pathname, children);
  const [open, setOpen] = useState(active);

  if (!expanded) {
    // Collapsed: hover-triggered popover (opens on hover, closes with small delay)
    return (
      <HoverNavGroup item={item} active={active} children={children} pathname={pathname} Icon={Icon} />
    );
  }

  // Expanded: inline toggle + children
  return (
    <div>
      <button onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium w-full",
          "transition-all duration-300 ease-out border-0 bg-transparent cursor-pointer",
          "hover:-translate-y-0.5 hover:shadow-md active:translate-y-0",
          active ? "text-primary dark:text-white"
                 : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}>
        <Icon size={iconSizeFor(item.label)} strokeWidth={active ? 2 : 1.7} className="shrink-0" />
        <span className="flex-1 text-left truncate">{item.label}</span>
        <ChevronDown size={14}
          className={cn("shrink-0 text-muted-foreground/50 transition-transform duration-300", open && "rotate-180")} />
      </button>
      <div className={cn(
        "overflow-hidden transition-all duration-300 ease-out",
        open ? "max-h-[500px] opacity-100 mt-0.5" : "max-h-0 opacity-0"
      )}>
        <div className="ml-[22px] space-y-0.5">
          {children.map((child) => {
            const ChildIcon = child.icon;
            const childActive = isHrefActive(pathname, child.href);
            return (
              <Link key={child.href} href={child.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] transition-colors duration-150",
                  childActive ? "nav-selected-sub font-medium"
                              : "text-muted-foreground/80 hover:bg-accent hover:text-foreground"
                )}>
                <ChildIcon size={14} className="shrink-0" />
                <span className="truncate">{child.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN SIDEBAR
   ═══════════════════════════════════════════════════════════ */

export function AppSidebar({
  permissions = [],
  unreadCount = 0,
  expanded = false,
  recentMissions = [],
  recentConversations = [],
}: {
  permissions?: string[];
  unreadCount?: number;
  expanded?: boolean;
  recentMissions?: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    progress: number | null;
  }>;
  recentConversations?: Array<{
    id: string;
    title: string;
    updatedAt: string;
  }>;
}) {
  const pathname = usePathname();
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const hasAllPerms = permissions.length === 0;
  const canAccessAdmin =
    hasAllPerms ||
    permissions.includes("system:manage_users") ||
    permissions.includes("system:manage_orgs") ||
    permissions.includes("system:manage_roles");

  function canSeeItem(href: string) {
    if (hasAllPerms) return true;
    const perm = MENU_PERMISSION_MAP[href];
    return !perm || permissions.includes(perm);
  }

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.children) return item.children.some((c) => canSeeItem(c.href));
    return canSeeItem(item.href);
  });

  const visibleMore = MORE_ITEMS.filter((i) => canSeeItem(i.href));

  return (
    <div className={cn(
      "flex flex-col h-full bg-white dark:bg-[#1a1a1a] shrink-0",
      "transition-[width] duration-300 ease-out overflow-hidden",
      expanded ? "w-[200px]" : "w-[60px]"
    )}>
      {/* Brand — Mulan Avatar */}
      <div className={cn(
        "flex items-center py-3 shrink-0 transition-all duration-300",
        expanded ? "px-4 gap-3" : "justify-center px-2"
      )}>
        <img
          src="/mulan.png"
          alt="穆兰"
          className={cn(
            "rounded-full object-cover shrink-0 transition-all duration-300",
            expanded ? "w-[72px] h-[72px]" : "w-9 h-9"
          )}
        />
        {expanded && (
          <span className="text-sm font-semibold text-foreground truncate">穆兰</span>
        )}
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-border/40 shrink-0" />

      {/* Nav */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden sidebar-scroll">
        <nav className={cn(
          "flex flex-col gap-0.5 px-2 py-1 transition-all duration-300",
          !expanded && "items-center"
        )}>
          {visibleNav.map((item) =>
            item.children ? (
              <NavGroup key={item.href} item={item} pathname={pathname} canSeeItem={canSeeItem} expanded={expanded} />
            ) : (
              <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label}
                active={isHrefActive(pathname, item.href)} expanded={expanded} />
            )
          )}
          {/* More */}
          {visibleMore.length > 0 && (
            <MoreButton items={visibleMore} pathname={pathname} expanded={expanded} />
          )}
          {canAccessAdmin && expanded && (
            <>
              <div className="mx-1 border-t border-border/40 shrink-0" />
              <div className="px-2 py-1.5">
                <span className="text-xs font-medium text-muted-foreground px-2">管理后台</span>
              </div>
              {ADMIN_ITEMS.filter(item => canSeeItem(item.href)).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                    pathname === item.href
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  )}
                >
                  <item.icon size={16} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </>
          )}
          {canAccessAdmin && !expanded && (
            <SettingsButton pathname={pathname} expanded={expanded} />
          )}
        </nav>
      </div>

      {/* History — only when expanded, at the bottom */}
      {expanded && (
        <div className="px-3 pb-2 shrink-0">
          <button
            type="button"
            onClick={() => setHistoryExpanded((v) => !v)}
            className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/40 transition-colors cursor-pointer bg-transparent"
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/70">
              <Clock size={12} />
              历史记录
            </div>
            <ChevronDown
              size={12}
              className={cn(
                "text-muted-foreground transition-transform duration-200",
                historyExpanded && "rotate-180",
              )}
            />
          </button>
          <div className={cn(
            "overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out",
            historyExpanded ? "max-h-[40vh] opacity-100 mt-1 overflow-y-auto scrollbar-thin" : "max-h-0 opacity-0",
          )}>
            <div className="space-y-2">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground px-2 mb-1">对话</p>
                <div className="space-y-0.5">
                  {recentConversations.length > 0 ? recentConversations.slice(0, 5).map((conv) => (
                    <a
                      key={conv.id}
                      href={`/chat?conversation=${conv.id}`}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <Crown size={11} className="text-rose-500 shrink-0" />
                      <span className="text-[11px] truncate">{conv.title}</span>
                      <span className="text-[9px] text-muted-foreground shrink-0 ml-auto">
                        {new Date(conv.updatedAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
                      </span>
                    </a>
                  )) : <span className="text-[11px] text-muted-foreground px-2">暂无</span>}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-medium text-muted-foreground px-2 mb-1">任务</p>
                <div className="space-y-0.5">
                  {recentMissions.length > 0 ? recentMissions.slice(0, 5).map((m) => {
                    const color = m.status === "completed" ? "text-emerald-500" : m.status === "failed" ? "text-red-400" : "text-blue-500";
                    const label = m.status === "completed" ? "完成" : m.status === "failed" ? "失败" : "进行中";
                    return (
                      <a
                        key={m.id}
                        href={`/missions/${m.id}`}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                      >
                        <FileText size={11} className="text-muted-foreground shrink-0" />
                        <span className="text-[11px] truncate">{m.title}</span>
                        <span className={cn("text-[9px] font-medium shrink-0 ml-auto", color)}>{label}</span>
                      </a>
                    );
                  }) : <span className="text-[11px] text-muted-foreground px-2">暂无</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
