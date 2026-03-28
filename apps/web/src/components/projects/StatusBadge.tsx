import type { ProjectStatus } from "@duckops/shared-types";
import { cn, getStatusColor, getStatusLabel, isActiveStatus } from "@/lib/utils";

interface StatusBadgeProps {
  status: ProjectStatus;
  message?: string | null;
}

export function StatusBadge({ status, message }: StatusBadgeProps) {
  const dot = getStatusColor(status);
  const label = getStatusLabel(status);
  const active = isActiveStatus(status);

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "inline-block w-2 h-2 rounded-full shrink-0",
          dot,
          active && "animate-pulse",
        )}
      />
      <span className="text-sm font-medium">{label}</span>
      {message && (
        <span className="text-xs text-gray-500 truncate max-w-[200px]">
          — {message}
        </span>
      )}
    </div>
  );
}
