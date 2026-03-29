import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        {
          "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20": variant === "default" || variant === "warning",
          "bg-surface-4 text-muted-2": variant === "secondary",
          "bg-red-500/10 text-red-400 ring-1 ring-red-500/20": variant === "destructive",
          "border border-border-2 text-muted-2": variant === "outline",
          "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20": variant === "success",
        },
        className,
      )}
      {...props}
    />
  );
}
