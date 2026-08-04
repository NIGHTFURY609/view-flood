import type { LucideIcon } from "lucide-react";

import { cn } from "@/shared/lib/cn";

export type StatTone = "indigo" | "green" | "amber" | "red";

const TONE: Record<StatTone, string> = {
  indigo: "text-[#7c8cf8] bg-[#7c8cf8]/15",
  green: "text-[#3fb950] bg-[#3fb950]/15",
  amber: "text-[#d29922] bg-[#d29922]/15",
  red: "text-[#f85149] bg-[#f85149]/15",
};

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: StatTone;
  wip?: boolean;
  loading?: boolean;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "indigo",
  wip = false,
  loading = false,
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-[#7c8cf8]/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {wip && (
              <span className="rounded-full bg-[#d29922]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#d29922]">
                WIP
              </span>
            )}
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            {loading ? (
              <span className="inline-block h-8 w-16 animate-pulse rounded-md bg-secondary align-middle" />
            ) : (
              value
            )}
          </p>
        </div>
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", TONE[tone])}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}
