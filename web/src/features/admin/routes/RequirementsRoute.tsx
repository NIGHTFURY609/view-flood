import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import {
  adminRequirementsQuery,
  approveRequirement,
  rejectRequirement,
} from "@/features/admin/api/adminRequirements";
import { ConfirmDialog } from "@/features/admin/components/ConfirmDialog";
import type {
  AdminRequirement,
  AdminRequirementItem,
  AdminRequirementsParams,
} from "@/features/admin/types";
import { Input } from "@/shared/components/ui/input";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { useIsDesktop } from "@/shared/hooks/useMediaQuery";
import { cn } from "@/shared/lib/cn";
import { isCatalogueKey } from "@/shared/lib/needs";

const PAGE_SIZE = 25;
const GRID =
  "44px minmax(0,2.1fr) minmax(0,1.4fr) minmax(0,1.3fr) minmax(0,1fr) 72px minmax(0,1.1fr) 104px";
const COLUMNS = ["Sl No", "Camp", "Requester", "Phone", "Item", "Qty", "Requested", "Action"] as const;

const TABS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
] as const;

type Tab = (typeof TABS)[number]["value"];

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-[#3fb950]/15 text-[#3fb950]",
  rejected: "bg-[#f85149]/15 text-[#f85149]",
};

export function RequirementsRoute() {
  const isDesktop = useIsDesktop();
  const [tab, setTab] = useState<Tab>("pending");
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);

  const q = useDebouncedValue(searchText, 300);

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
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);
  const isRefetching = requirements.isFetching && !requirements.isPending;
  const fmt = (n: number) => n.toLocaleString("en-IN");

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
        <div
          style={{ gridTemplateColumns: GRID }}
          className="hidden shrink-0 items-center gap-4 border-b border-border px-4 py-3 lg:grid"
        >
          {COLUMNS.map((col) => (
            <span
              key={col}
              className={cn(
                "text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                col === "Action" && "text-right",
              )}
            >
              {col}
            </span>
          ))}
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto">
          {requirements.isPending ? (
            <BodySkeleton isDesktop={isDesktop} />
          ) : rows.length === 0 ? (
            <div className="grid h-full place-items-center py-12 text-sm text-muted-foreground">
              No requests here.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {rows.map((requirement, i) => (
                <RequirementRow
                  key={requirement.id}
                  requirement={requirement}
                  serial={(page - 1) * PAGE_SIZE + i + 1}
                  isDesktop={isDesktop}
                />
              ))}
            </div>
          )}

          {isRefetching && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/50 backdrop-blur-[1px]">
              <Loader2 className="size-6 animate-spin text-accent" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-3">
          <p className="truncate text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{rangeStart}</span>–
            <span className="font-medium text-foreground">{rangeEnd}</span> of{" "}
            <span className="font-medium text-foreground">{fmt(total)}</span>
          </p>
          <div className="flex items-center gap-2">
            <PageButton
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              icon={ChevronLeft}
              label="Previous page"
            />
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {page} / {pageCount}
            </span>
            <PageButton
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              icon={ChevronRight}
              label="Next page"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function itemName(item: AdminRequirementItem): string {
  if (!isCatalogueKey(item.item_key)) return item.label ?? item.item_key;
  return item.item_key.replace(/_/g, " ");
}

function RequirementRow({
  requirement,
  serial,
  isDesktop,
}: {
  requirement: AdminRequirement;
  serial: number;
  isDesktop: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<"approve" | "reject" | null>(null);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin", "requirements"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "requirement", requirement.id] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "camp", requirement.camp_id] });
  }

  const approve = useMutation({
    mutationFn: () => approveRequirement(requirement.id),
    onSuccess: () => {
      setConfirming(null);
      refresh();
    },
  });
  const reject = useMutation({
    mutationFn: () => rejectRequirement(requirement.id),
    onSuccess: () => {
      setConfirming(null);
      refresh();
    },
  });

  const pending = requirement.status === "pending";
  const first = requirement.items[0];
  const extra = requirement.items.length - 1;
  const itemLabel = first ? itemName(first) : "—";
  const qtyLabel = first ? `${first.quantity.toLocaleString("en-IN")} ${first.unit}` : "—";
  const open = () => navigate(`/admin/requirements/${requirement.id}`);

  const actionCell = pending ? (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setConfirming("approve")}
        disabled={approve.isPending}
        aria-label="Approve request"
        title="Approve"
        className="inline-flex size-7 items-center justify-center rounded-md text-[#3fb950] transition-colors hover:bg-[#3fb950]/15 disabled:opacity-50"
      >
        {approve.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
      </button>
      <button
        type="button"
        onClick={() => setConfirming("reject")}
        disabled={reject.isPending}
        aria-label="Reject request"
        title="Reject"
        className="inline-flex size-7 items-center justify-center rounded-md text-[#d29922] transition-colors hover:bg-[#d29922]/15 disabled:opacity-50"
      >
        {reject.isPending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
      </button>
    </div>
  ) : (
    <div className="flex justify-end">
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
          STATUS_STYLE[requirement.status] ?? "bg-secondary text-muted-foreground",
        )}
      >
        {requirement.status}
      </span>
    </div>
  );

  return (
    <>
      {isDesktop ? (
        <div
          style={{ gridTemplateColumns: GRID }}
          onClick={open}
          className="grid cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-secondary/40"
        >
          <span className="tabular-nums text-muted-foreground">{serial}</span>
          <span className="font-medium text-foreground">{requirement.camp_name ?? "Camp"}</span>
          <span className="text-muted-foreground">{requirement.submitter_name}</span>
          <span className="whitespace-nowrap tabular-nums text-muted-foreground">
            {requirement.submitter_phone}
          </span>
          <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
            <span className="capitalize">{itemLabel}</span>
            {extra > 0 ? (
              <span className="shrink-0 text-xs text-muted-foreground/70">+{extra}</span>
            ) : null}
          </span>
          <span className="tabular-nums text-muted-foreground">{qtyLabel}</span>
          <span className="text-muted-foreground">{fmtDate(requirement.created_at)}</span>
          {actionCell}
        </div>
      ) : (
        <div
          onClick={open}
          className="flex cursor-pointer items-start gap-3 p-4 transition-colors hover:bg-secondary/40"
        >
          <div className="min-w-0 flex-1">
            <span className="block font-medium text-foreground">
              {requirement.camp_name ?? "Camp"}
            </span>
            <p className="mt-1 text-xs text-muted-foreground">
              {requirement.submitter_name} · {requirement.submitter_phone}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="capitalize">{itemLabel}</span> ·{" "}
              <span className="tabular-nums">{qtyLabel}</span>
              {extra > 0 ? <span className="text-muted-foreground/70"> +{extra}</span> : null}
            </p>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="tabular-nums">#{serial}</span>
              <span>{fmtDate(requirement.created_at)}</span>
            </div>
          </div>
          {actionCell}
        </div>
      )}

      <ConfirmDialog
        open={confirming === "approve"}
        onOpenChange={(o) => !o && setConfirming(null)}
        title="Approve this request?"
        description={`${requirement.items.length} item(s) will be added to this camp's public needs. Quantities are added to whatever is already listed.`}
        confirmLabel="Approve"
        loading={approve.isPending}
        onConfirm={() => approve.mutate()}
      />
      <ConfirmDialog
        open={confirming === "reject"}
        onOpenChange={(o) => !o && setConfirming(null)}
        title="Reject this request?"
        description="The request is closed and nothing is added to this camp's needs. It stays under the All tab as rejected."
        confirmLabel="Reject"
        destructive
        loading={reject.isPending}
        onConfirm={() => reject.mutate()}
      />
    </>
  );
}

function BodySkeleton({ isDesktop }: { isDesktop: boolean }) {
  if (isDesktop) {
    return (
      <>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{ gridTemplateColumns: GRID }}
            className="grid items-center gap-4 border-b border-border/60 px-4 py-3"
          >
            {COLUMNS.map((c) => (
              <span key={c} className="h-4 w-16 animate-pulse rounded bg-secondary" />
            ))}
          </div>
        ))}
      </>
    );
  }
  return (
    <div className="divide-y divide-border/60">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 p-4">
          <span className="h-4 w-40 animate-pulse rounded bg-secondary" />
          <span className="h-3 w-56 animate-pulse rounded bg-secondary" />
          <span className="h-3 w-24 animate-pulse rounded bg-secondary" />
        </div>
      ))}
    </div>
  );
}

function fmtDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
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
