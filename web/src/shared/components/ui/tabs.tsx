import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/cn";

/** Radix gives correct roving tabindex; the prototype hand-rolled role="tablist". */
export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border bg-secondary p-1",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-2",
        "text-sm font-semibold text-muted-foreground",
        "transition-colors duration-(--duration-fast)",
        "hover:text-foreground",
        "data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-panel",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = TabsPrimitive.Content;
