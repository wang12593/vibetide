"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, Menu, X } from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ChatLauncher } from "@/components/shared/chat-launcher";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  userName: string;
  unreadCount: number;
  permissions: string[];
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
  children: React.ReactNode;
}

const SIDEBAR_COLLAPSED = 60;
const SIDEBAR_EXPANDED = 200;

function useBreakpoint() {
  const [bp, setBp] = useState<"sm" | "md" | "lg">("lg");
  useEffect(() => {
    const mql = () => {
      if (window.innerWidth < 768) return "sm" as const;
      if (window.innerWidth < 1024) return "md" as const;
      return "lg" as const;
    };
    setBp(mql());
    const handler = () => setBp(mql());
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return bp;
}

export function DashboardShell({
  userName,
  unreadCount,
  permissions,
  recentMissions = [],
  recentConversations = [],
  children,
}: DashboardShellProps) {
  const bp = useBreakpoint();
  const isMobile = bp === "sm";
  const isTablet = bp === "md";
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) setMobileMenuOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  const buttonLeft = (sidebarExpanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED) - 12;

  if (isMobile) {
    return (
      <div className="relative flex flex-col h-svh overflow-hidden">
        <Topbar userName={userName} unreadCount={unreadCount} />
        <main className="flex-1 overflow-hidden bg-[#f5f5f5] dark:bg-[#111]">
          <div className="relative z-10 p-3 h-full overflow-y-auto scrollbar-thin">{children}</div>
        </main>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-[260px] bg-white dark:bg-slate-900 shadow-2xl">
              <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-700">
                <span className="text-sm font-semibold">导航</span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X size={18} />
                </button>
              </div>
              <AppSidebar
                permissions={permissions}
                unreadCount={unreadCount}
                expanded={true}
                recentMissions={recentMissions}
                recentConversations={recentConversations}
              />
            </div>
          </div>
        )}

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="fixed bottom-4 left-4 z-40 w-12 h-12 rounded-full bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center"
        >
          <Menu size={20} className="text-slate-600 dark:text-slate-300" />
        </button>

        <ChatLauncher />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-svh overflow-hidden">
      <Topbar userName={userName} unreadCount={unreadCount} />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar
          permissions={permissions}
          unreadCount={unreadCount}
          expanded={isTablet ? true : sidebarExpanded}
          recentMissions={recentMissions}
          recentConversations={recentConversations}
        />

        {!isTablet && (
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            aria-label={sidebarExpanded ? "收起菜单" : "展开菜单"}
            className={cn(
              "absolute z-30",
              "w-6 h-12 rounded-full flex items-center justify-center",
              "bg-white/85 dark:bg-slate-800/85 backdrop-blur-md",
              "border border-white/80 dark:border-slate-600/50",
              "shadow-[0_4px_16px_-4px_rgba(30,58,138,0.2),0_8px_24px_-8px_rgba(30,58,138,0.15)]",
              "dark:shadow-[0_4px_16px_-4px_rgba(2,6,23,0.5),0_8px_24px_-8px_rgba(2,6,23,0.6)]",
              "hover:scale-110 hover:bg-white dark:hover:bg-slate-700",
              "active:scale-95",
              "cursor-pointer border-0"
            )}
            style={{
              top: "calc(56px + 50% - 24px)",
              left: buttonLeft,
              transition:
                "left 300ms cubic-bezier(0.22, 0.68, 0.35, 1), transform 200ms ease-out, background-color 200ms ease-out, box-shadow 200ms ease-out",
            }}
          >
            <ChevronLeft
              size={14}
              strokeWidth={2.2}
              className="text-slate-600 dark:text-slate-200"
              style={{
                transform: sidebarExpanded ? "rotate(0deg)" : "rotate(180deg)",
                transition: "transform 300ms cubic-bezier(0.22, 0.68, 0.35, 1)",
              }}
            />
          </button>
        )}

        <main className="flex-1 overflow-hidden bg-[#f5f5f5] dark:bg-[#111]">
          <div className={cn("relative z-10 h-full overflow-y-auto scrollbar-thin", isTablet ? "p-4" : "p-6")}>{children}</div>
        </main>
      </div>

      <ChatLauncher />
    </div>
  );
}
