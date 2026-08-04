import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/cn";

/**
 * Reserves layout space while data loads so content does not jump in.
 * aria-hidden: the loading state is announced once by the container's
 * aria-busy, not by every individual bar.
 */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
