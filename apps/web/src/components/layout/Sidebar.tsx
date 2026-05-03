"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Folder,
  Plus,
  BookOpen,
  LogOut,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  GraduationCap,
  CreditCard,
  Zap,
  Settings,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { resetAndRunTour } from "@/components/tutorial/OnboardingTour";
import { billingApi } from "@/lib/api";

const navItems = [
  { href: "/projects", label: "Projects", icon: Folder, exact: true },
  { href: "/projects/new", label: "New Project", icon: Plus, exact: true },
  { href: "/templates", label: "Templates", icon: BookOpen, exact: true },
  { href: "/logs", label: "All Logs", icon: ScrollText, exact: false },
  { href: "/billing", label: "Billing", icon: CreditCard, exact: true },
  { href: "/settings", label: "Settings", icon: Settings, exact: true },
];

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  return pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [devModeLoading, setDevModeLoading] = useState(false);

  useEffect(() => {
    billingApi.getStatus().then((s) => setDevMode(s.devMode)).catch(() => {});
  }, []);

  const toggleDevMode = async () => {
    setDevModeLoading(true);
    try {
      const { devMode: next } = await billingApi.toggleDevMode();
      setDevMode(next);
    } finally {
      setDevModeLoading(false);
    }
  };

  return (
    <aside
      className={cn(
        "shrink-0 flex flex-col min-h-screen border-r border-border bg-surface relative transition-all duration-300 z-20",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center border-b border-border h-16", collapsed ? "justify-center px-0" : "px-5 gap-3")}>
        <Link href="/projects" className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center shrink-0">
            <GitBranch className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-bold text-foreground leading-none">DuckOps</p>
              <p className="text-xs text-muted leading-none mt-0.5">Dev Platform</p>
            </div>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(pathname, href, exact);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-amber-600 text-white shadow-lg shadow-amber-900/30"
                  : "text-muted-2 hover:bg-surface-3 hover:text-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-[72px] w-6 h-6 bg-surface-3 border border-border-2 rounded-full flex items-center justify-center text-muted hover:text-foreground hover:bg-surface-4 z-20"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>

      {/* Dev mode toggle */}
      <div className={cn("px-3 pb-1", collapsed && "px-2")}>
        <button
          onClick={toggleDevMode}
          disabled={devModeLoading}
          title={collapsed ? `Dev mode ${devMode ? "on" : "off"}` : undefined}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-all",
            devMode
              ? "bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500/15"
              : "text-muted-2 hover:bg-surface-3 hover:text-foreground",
            collapsed && "justify-center px-0",
            devModeLoading && "opacity-50",
          )}
        >
          <Zap className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <span className="flex-1 text-left">Dev Mode</span>
          )}
          {!collapsed && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${devMode ? "bg-amber-500/20 text-amber-500" : "bg-surface-3 text-muted border border-border"}`}>
              {devMode ? "ON" : "OFF"}
            </span>
          )}
        </button>
      </div>

      {/* Tutorial button */}
      <div className={cn("px-3 pb-2", collapsed && "px-2")}>
        <button
          onClick={() => resetAndRunTour(pathname)}
          title="Run tutorial"
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-muted-2 hover:bg-surface-3 hover:text-foreground transition-all",
            collapsed && "justify-center px-0",
          )}
        >
          <GraduationCap className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Run Tutorial</span>}
        </button>
      </div>

      {/* User footer */}
      <div className={cn("p-3 border-t border-border", collapsed && "px-2")}>
        {user ? (
          <div className={cn("flex items-center gap-3", collapsed && "flex-col gap-2")}>
            <Link href="/settings" title="Account settings" className="shrink-0">
              {user.avatarUrl ? (
                <Image
                  src={user.avatarUrl}
                  alt={user.name}
                  width={32}
                  height={32}
                  className="rounded-full ring-2 ring-border-2 hover:ring-amber-500/50 transition-all"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-sm font-bold hover:bg-amber-500 transition-all">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
            </Link>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                  <p className="text-xs text-muted truncate">@{user.githubUsername}</p>
                </div>
                <button
                  onClick={logout}
                  title="Sign out"
                  className="text-muted hover:text-foreground p-1 rounded"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            )}
            {collapsed && (
              <button
                onClick={logout}
                title="Sign out"
                className="text-muted hover:text-foreground p-1 rounded"
              >
                <LogOut className="h-3 w-3" />
              </button>
            )}
          </div>
        ) : (
          !collapsed && <p className="text-xs text-muted px-3">DuckOps v1.0.0</p>
        )}
      </div>
    </aside>
  );
}
