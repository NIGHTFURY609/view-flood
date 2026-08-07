import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { adminRequirementsQuery } from "@/features/admin/api/adminRequirements";
import { RequirementCard } from "@/features/admin/components/RequirementCard";
import type { AdminRequirementsParams } from "@/features/admin/types";
import { Input } from "@/shared/components/ui/input";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { cn } from "@/shared/lib/cn";

const PAGE_SIZE = 25;

const TABS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
] as const;

type Tab = (typeof TABS)[number]["value"];

export function RequirementsRoute() {
  const [tab, setTab] = useState<Tab>("pending");
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);

  const q = useDebouncedValue(searchText, 300);

  // A new filter invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [tab, q]);

  const params: AdminRequirementsParams = {
    status: tab,
    limit: PAGE_SIZE,
    ...(q ? { q } : {}),
    ...(page > 1 ? { cursor: String((page - 1) * PAGE_SIZE) } : {}),
  };

  const requirements = useQuery(adminRequirementsQuery(params));

  const rows = requirements.data?.items ?? [];
  const total = requirements.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isRefetching = requirements.isFetching && !requirements.isPending;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div
          role="tablist"
          aria-label="Request status"
          className="flex gap-1 rounded-lg border border-border bg-surface p-1"
        >
          {TABS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={tab === option.value}
              onClick={() => setTab(option.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                "transition-colors duration-(--duration-fast)",
                tab === option.value
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-0 sm:ml-auto sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search camp, name or phone…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface">
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          {requirements.isPending ? (
            <div className="divide-y divide-border/60">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2 p-4">
                  <span className="h-4 w-48 animate-pulse rounded bg-secondary" />
                  <span className="h-6 w-64 animate-pulse rounded bg-secondary" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="grid h-full place-items-center py-12 text-sm text-muted-foreground">
              No requests here.
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {rows.map((requirement) => (
                <RequirementCard key={requirement.id} requirement={requirement} />
              ))}
            </ul>
          )}

          {isRefetching && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/50 backdrop-blur-[1px]">
              <Loader2 className="size-6 animate-spin text-accent" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{total.toLocaleString("en-IN")}</span>{" "}
            requests
          </p>
          <div className="flex items-center gap-2">
            <PageButton
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              icon={ChevronLeft}
              label="Previous"
            />
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {page} / {pageCount}
            </span>
            <PageButton
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              icon={ChevronRight}
              label="Next"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PageButton({
  onClick,
  disabled,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  icon: typeof ChevronLeft;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-muted-foreground"
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}
