import { cn } from "@/lib/utils";
import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive" | "link" | "success";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      isLoading,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-50 disabled:pointer-events-none",
          {
            "bg-amber-600 text-white hover:bg-amber-500 shadow-sm shadow-amber-900/30": variant === "default",
            "border border-border-2 bg-surface-3 text-foreground hover:bg-surface-4 hover:border-muted": variant === "outline",
            "text-muted-2 hover:bg-surface-3 hover:text-foreground": variant === "ghost",
            "bg-red-600 text-white hover:bg-red-500": variant === "destructive",
            "bg-emerald-600 text-white hover:bg-emerald-500": variant === "success",
            "text-amber-400 hover:underline p-0 h-auto": variant === "link",
          },
          {
            "h-9 px-4 py-2 text-sm": size === "default",
            "h-7 px-3 text-xs": size === "sm",
            "h-11 px-6 text-sm": size === "lg",
            "h-9 w-9 p-0": size === "icon",
          },
          className,
        )}
        {...props}
      >
        {isLoading ? (
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : null}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
