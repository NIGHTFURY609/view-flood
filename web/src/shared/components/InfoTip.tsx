import { Info } from "lucide-react";
import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/cn";

/**
 * Keeps the visible surface low-text (PRD: tooltips carry the detail) without
 * hiding information from assistive tech — Radix wires aria-describedby, and
 * the trigger is a real button so it is keyboard reachable.
 */
export function InfoTip({ label, className }: { label: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={label}
        className={cn(
          "inline-flex size-11 shrink-0 items-center justify-center rounded-full",
          "text-muted-foreground cursor-pointer",
          "transition-colors duration-(--duration-fast) hover:text-foreground",
          className,
        )}
      >
        <Info className="size-4" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Wraps any control to give it an accessible name plus a visible explanation. */
export function Hint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
