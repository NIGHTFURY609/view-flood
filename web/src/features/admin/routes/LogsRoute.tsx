import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { adminLogsQuery } from "@/features/admin/api/adminLogs";
import type { AuditLogEntry } from "@/features/admin/types";
import { cn } from "@/shared/lib/cn";

const PAGE_SIZE = 25;

const ACTION_STYLE: Record<string, { label: string; className: string }> = {
  camp_approved: { label: "Approved", className: "bg-[#3fb950]/15 text-[#3fb950]" },
  camp_rejected: { label: "Rejected", className: "bg-[#d29922]/15 text-[#d29922]" },
  camp_deleted: { label: "Deleted", className: "bg-[#f85149]/15 text-[#f85149]" },
  camp_updated: { label: "Updated", className: "bg-accent/15 text-accent" },
  camp_verified: { label: "Verified", className: "bg-[#3fb950]/15 text-[#3fb950]" },
  camp_removed: { label: "Removed", className: "bg-[#f85149]/15 text-[#f85149]" },
  image_hidden: { label: "Image hidden", className: "bg-[#f85149]/15 text-[#f85149]" },
};

function actionStyle(action: string) {
  return (
    ACTION_STYLE[action] ?? {
      label: action.replace(/_/g, " "),
      className: "bg-secondary text-muted-foreground",
    }
  );
}

function fmtDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export function LogsRoute() {
  const [page, setPage] = useState(1);
  const logs = useQuery(
    adminLogsQuery({ limit: PAGE_SIZE, cursor: page > 1 ? String((page - 1) * PAGE_SIZE) : "" }),
  );

  useEffect(() => {
    // no-op; page changes refetch via query key
  }, [page]);

  const rows = logs.data?.items ?? [];
  const total = logs.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isRefetching = logs.isFetching && !logs.isPending;

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface">
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          {logs.isPending ? (
            <div className="divide-y divide-border/60">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4">
                  <span className="h-6 w-20 animate-pulse rounded-full bg-secondary" />
                  <span className="h-4 w-48 animate-pulse rounded bg-secondary" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="grid h-full place-items-center py-12 text-sm text-muted-foreground">
              No activity yet.
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {rows.map((entry) => (
                <LogRow key={entry.id} entry={entry} />
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
            <span className="font-medium text-foreground">{total.toLocaleString("en-IN")}</span> entries
          </p>
          <div className="flex items-center gap-2">
            <PageButton onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} icon={ChevronLeft} label="Previous" />
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {page} / {pageCount}
            </span>
            <PageButton onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} icon={ChevronRight} label="Next" />
          </div>
        </div>
      </div>
    </div>
  );
}

function LogRow({ entry }: { entry: AuditLogEntry }) {
  const style = actionStyle(entry.action);
  return (
    <li className="flex items-start gap-3 p-4">
      <span
        className={cn(
          "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
          style.className,
        )}
      >
        {style.label}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">
          <span className="capitalize">{entry.entity_type}</span>
          {entry.entity_id && (
            <span className="ml-1.5 font-mono text-xs text-muted-foreground">
              {entry.entity_id.slice(0, 8)}
            </span>
          )}
        </p>
        {entry.note && <p className="mt-0.5 truncate text-xs text-muted-foreground">{entry.note}</p>}
        <p className="mt-1 text-xs text-muted-foreground">
          {entry.actor_type}
          {entry.actor_id && ` · ${entry.actor_id.slice(0, 8)}`} · {fmtDate(entry.created_at)}
        </p>
      </div>
    </li>
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
