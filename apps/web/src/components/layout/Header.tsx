"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface HeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function Header({ title, description, actions }: HeaderProps) {
  const { theme, toggle } = useTheme();

  return (
    <div className="flex items-center justify-between py-4 px-8 border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        {description && (
          <p className="text-sm text-muted-2 mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <button
          onClick={toggle}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="w-8 h-8 rounded-lg border border-border-2 bg-surface-3 flex items-center justify-center text-muted-2 hover:text-white hover:bg-surface-4 hover:border-muted transition-all"
        >
          {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
