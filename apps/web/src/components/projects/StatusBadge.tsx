import type { ProjectStatus } from "@duckops/shared-types";
import { cn, getStatusColor, getStatusLabel, isActiveStatus } from "@/lib/utils";

interface StatusBadgeProps {
  status: ProjectStatus;
  message?: string | null;
  size?: "sm" | "default";
}

export function StatusBadge({ status, message, size = "default" }: StatusBadgeProps) {
  const dot = getStatusColor(status);
  const label = getStatusLabel(status);
  const active = isActiveStatus(status);

  return (
    <div className="flex items-center gap-2">
      <span className="relative inline-flex shrink-0">
        <span className={cn("inline-block rounded-full shrink-0", dot, size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2")} />
        {active && (
          <span className={cn("absolute inset-0 rounded-full animate-ping-slow opacity-70", dot)} />
        )}
      </span>
      <span className={cn("font-medium text-foreground", size === "sm" ? "text-xs" : "text-sm")}>{label}</span>
      {message && (
        <span className={cn("text-muted truncate max-w-[240px]", size === "sm" ? "text-xs" : "text-xs")}>
          — {message}
        </span>
      )}
    </div>
  );
}
