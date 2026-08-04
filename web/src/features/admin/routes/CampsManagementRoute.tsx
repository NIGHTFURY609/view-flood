import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, BarChart3, ChevronDown, ShieldAlert, Tent, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { adminCampsQuery } from "@/features/admin/api/adminCamps";
import { CampsTable } from "@/features/admin/components/CampsTable";
import { StatCard } from "@/features/admin/components/StatCard";
import { cn } from "@/shared/lib/cn";

export function CampsManagementRoute() {
  // Analytics are always shown on desktop; collapsed by default on mobile.
  const [statsOpen, setStatsOpen] = useState(false);

  const totalQ = useQuery(adminCampsQuery({ verification: "all", limit: 1 }));
  const verifiedQ = useQuery(adminCampsQuery({ verification: "verified", limit: 1 }));
  const unverifiedQ = useQuery(adminCampsQuery({ verification: "unverified", limit: 1 }));
  const fmt = (n: number) => n.toLocaleString("en-IN");

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="shrink-0 space-y-3">
        {/* Mobile-only toggle */}
        <button
          type="button"
          onClick={() => setStatsOpen((v) => !v)}
          aria-expanded={statsOpen}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground lg:hidden"
        >
          <span className="flex items-center gap-2">
            <BarChart3 className="size-4 text-accent" aria-hidden="true" />
            Analytics
          </span>
          <ChevronDown
            className={cn("size-4 transition-transform", statsOpen && "rotate-180")}
            aria-hidden="true"
          />
        </button>

        <div
          className={cn(
            "grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4",
            !statsOpen && "hidden lg:grid",
          )}
        >
          <StatCard label="Total Camps" value={fmt(totalQ.data?.total ?? 0)} icon={Tent} tone="indigo" loading={totalQ.isPending} />
          <StatCard label="Verified Camps" value={fmt(verifiedQ.data?.total ?? 0)} icon={BadgeCheck} tone="green" loading={verifiedQ.isPending} />
          <StatCard label="Unverified Camps" value={fmt(unverifiedQ.data?.total ?? 0)} icon={ShieldAlert} tone="amber" loading={unverifiedQ.isPending} />
          <StatCard label="Needs Attention" value="—" icon={TriangleAlert} tone="red" wip />
        </div>
      </div>

      <CampsTable />
    </div>
  );
}
