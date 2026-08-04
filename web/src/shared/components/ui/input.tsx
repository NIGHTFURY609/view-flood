import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/cn";

export function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex min-h-11 w-full rounded-lg border border-input bg-surface px-3 py-2",
        // 16px prevents iOS Safari from zooming the viewport on focus.
        "text-base text-foreground placeholder:text-muted-foreground",
        "transition-colors duration-(--duration-fast)",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-[invalid=true]:border-critical aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-critical",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full rounded-lg border border-input bg-surface px-3 py-2",
        "text-base text-foreground placeholder:text-muted-foreground",
        "transition-colors duration-(--duration-fast)",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-[invalid=true]:border-critical",
        className,
      )}
      {...props}
    />
  );
}
