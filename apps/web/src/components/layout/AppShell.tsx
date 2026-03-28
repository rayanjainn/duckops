"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

const NO_SIDEBAR_PATHS = ["/login", "/auth/callback"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = !NO_SIDEBAR_PATHS.some((p) => pathname.startsWith(p));

  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
