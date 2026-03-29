import { cn } from "@/lib/utils";
import React from "react";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-lg border border-border-2 bg-surface-3 px-3 py-1 text-sm text-foreground shadow-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";
