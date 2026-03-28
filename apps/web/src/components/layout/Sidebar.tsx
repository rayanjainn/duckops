"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderPlus, Folder, BookTemplate, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: Folder },
  { href: "/projects/new", label: "New Project", icon: FolderPlus },
  { href: "/templates", label: "Templates", icon: BookTemplate },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="w-60 shrink-0 bg-gray-900 text-white flex flex-col min-h-screen">
      {/* Logo */}
      <div className="p-6 border-b border-gray-700">
        <Link href="/dashboard" className="flex items-center gap-3">
          <span className="text-2xl">🦆</span>
          <span className="text-xl font-bold">DuckOps</span>
        </Link>
        <p className="text-xs text-gray-400 mt-1">Developer Platform</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-blue-600 text-white"
                : "text-gray-300 hover:bg-gray-700 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* User footer */}
      <div className="p-4 border-t border-gray-700">
        {user ? (
          <div className="flex items-center gap-3">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt={user.name}
                width={32}
                height={32}
                className="rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-gray-400 truncate">@{user.githubUsername}</p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="text-xs text-gray-400">
            <p>DuckOps v1.0.0</p>
          </div>
        )}
      </div>
    </aside>
  );
}
