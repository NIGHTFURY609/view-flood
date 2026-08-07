import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  BadgeCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronRight as RowChevron,
  Loader2,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import {
  adminCampsQuery,
  approveAdminCamp,
  denyAdminCamp,
  rejectAdminCamp,
} from "@/features/admin/api/adminCamps";
import { adminRequirementCountsQuery } from "@/features/admin/api/adminRequirements";
import { ConfirmDialog } from "@/features/admin/components/ConfirmDialog";
import { CampsFilterDialog, EMPTY_FILTERS } from "@/features/admin/components/CampsFilterDialog";
import type { AdminCampsParams, CampFilters, Verification } from "@/features/admin/types";
import { districtsQuery } from "@/features/camps/api";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { useIsDesktop } from "@/shared/hooks/useMediaQuery";
import { cn } from "@/shared/lib/cn";
import type { CampListItem } from "@/shared/types/api";

const PAGE_SIZE = 10;
const ROW_HEIGHT = 52;
const GRID =
  "56px minmax(0,2.2fr) minmax(0,1.2fr) minmax(0,1fr) minmax(0,1.3fr) minmax(0,1.2fr) minmax(0,1.1fr) 120px";
const COLUMNS = [
  "Sl No",
  "Camp Name",
  "District",
  "Taluk",
  "Local Body",
  "Camp Manager",
  "Phone Number",
  "Action",
] as const;

type SearchField = "name" | "phone";
type ActionsMode = "open" | "review";

interface CampsTableProps {
  /** When set, verification is fixed to this value and hidden from the filter. */
  lockedVerification?: Verification;
  /** Narrow to the reported queue (unreviewed unverified camps). */
  reviewed?: "unreviewed";
  /** "review" adds Approve/Reject/Deny buttons in the action column. */
  actions?: ActionsMode;
}

export function CampsTable({ lockedVerification, reviewed, actions = "open" }: CampsTableProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const parentRef = useRef<HTMLDivElement>(null);
  const isDesktop = useIsDesktop();

  const [searchField, setSearchField] = useState<SearchField>("name");
  const [searchText, setSearchText] = useState("");
  const debouncedSearch = useDebouncedValue(searchText.trim(), 300);
  const [filters, setFilters] = useState<CampFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<CampListItem | null>(null);
  const [rejectTarget, setRejectTarget] = useState<CampListItem | null>(null);
  const [denyTarget, setDenyTarget] = useState<CampListItem | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, searchField, filters]);

  // One aggregate for the whole table — the camps listing itself carries no
  // per-row count, so this stays a separate, independently cached query.
  const requirementCounts = useQuery(adminRequirementCountsQuery());

  const districts = useQuery(districtsQuery());
  const districtName = useMemo(
    () => new Map((districts.data ?? []).map((d) => [d.code, d.name])),
    [districts.data],
  );

  const verification = lockedVerification ?? filters.verification;
  const listParams: AdminCampsParams = {
    ...(debouncedSearch && searchField === "name" ? { q: debouncedSearch } : {}),
    ...(debouncedSearch && searchField === "phone" ? { phone: debouncedSearch } : {}),
    ...(verification !== "all" ? { verification } : {}),
    ...(reviewed ? { reviewed } : {}),
    ...(filters.district_code ? { district_code: filters.district_code } : {}),
    ...(filters.taluk ? { taluk: filters.taluk } : {}),
    ...(filters.lsg_name ? { lsg_name: filters.lsg_name } : {}),
    limit: PAGE_SIZE,
    cursor: page > 1 ? String((page - 1) * PAGE_SIZE) : "",
  };
  const camps = useQuery(adminCampsQuery(listParams));

  const approve = useMutation({
    mutationFn: approveAdminCamp,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "camps"] });
      toast.success("Camp approved", { description: "It now appears in the public app." });
      setApproveTarget(null);
    },
    onError: () => toast.error("Could not approve camp"),
  });
  const reject = useMutation({
    mutationFn: (id: string) => rejectAdminCamp(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "camps"] });
      toast.success("Camp rejected", { description: "Left as unverified, removed from the queue." });
      setRejectTarget(null);
    },
    onError: () => toast.error("Could not reject camp"),
  });
  const deny = useMutation({
    mutationFn: denyAdminCamp,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "camps"] });
      toast.success("Camp deleted", { description: "The camp has been removed." });
      setDenyTarget(null);
    },
    onError: () => toast.error("Could not delete camp"),
  });

  const rows = camps.data?.items ?? [];
  const total = camps.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);
  const isRefetching = camps.isFetching && !camps.isPending;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  useEffect(() => {
    parentRef.current?.scrollTo({ top: 0 });
  }, [page]);

  const openDetail = (id: string) => navigate(`/admin/camps/${id}`);
  const serial = (i: number) => (page - 1) * PAGE_SIZE + i + 1;
  const fmt = (n: number) => n.toLocaleString("en-IN");
  const activeFilters =
    (!lockedVerification && filters.verification !== "all" ? 1 : 0) +
    (filters.district_code ? 1 : 0) +
    (filters.taluk ? 1 : 0) +
    (filters.lsg_name ? 1 : 0);

  const rowProps = (camp: CampListItem, index: number) => ({
    camp,
    serial: serial(index),
    districtName,
    actions,
    requirementCount: requirementCounts.data?.by_camp[camp.id] ?? 0,
    approving: approve.isPending && approve.variables === camp.id,
    rejecting: reject.isPending && reject.variables === camp.id,
    onOpen: () => openDetail(camp.id),
    onApprove: () => setApproveTarget(camp),
    onReject: () => setRejectTarget(camp),
    onDeny: () => setDenyTarget(camp),
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex gap-2">
          <Select value={searchField} onValueChange={(v) => setSearchField(v as SearchField)}>
            <SelectTrigger className="w-36 shrink-0 sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Camp Name</SelectItem>
              <SelectItem value="phone">Phone Number</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={searchField === "name" ? "Search camp name…" : "Search phone…"}
              className="pl-9"
            />
          </div>
        </div>

        <Button
          variant="outline"
          size="md"
          onClick={() => setFilterOpen(true)}
          className="w-full sm:ml-auto sm:w-auto"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filter
          {activeFilters > 0 && (
            <span className="ml-0.5 grid size-5 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
              {activeFilters}
            </span>
          )}
        </Button>
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
                "truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                col === "Action" && "text-right",
              )}
            >
              {col}
            </span>
          ))}
        </div>

        <div className="relative min-h-0 flex-1">
          <div ref={parentRef} className="h-full overflow-y-auto">
            {camps.isPending ? (
              <BodySkeleton isDesktop={isDesktop} />
            ) : rows.length === 0 ? (
              <div className="grid h-full place-items-center py-12 text-sm text-muted-foreground">
                No camps match your search.
              </div>
            ) : isDesktop ? (
              <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
                {virtualizer.getVirtualItems().map((vi) => {
                  const camp = rows[vi.index];
                  if (!camp) return null;
                  return (
                    <TableRow
                      key={camp.id}
                      {...rowProps(camp, vi.index)}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: vi.size,
                        transform: `translateY(${vi.start}px)`,
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {rows.map((camp, i) => (
                  <CampCard key={camp.id} {...rowProps(camp, i)} />
                ))}
              </div>
            )}
          </div>

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
            <PageButton onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} icon={ChevronLeft} label="Previous page" />
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {page} / {pageCount}
            </span>
            <PageButton onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} icon={ChevronRight} label="Next page" />
          </div>
        </div>
      </div>

      <CampsFilterDialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        value={filters}
        onApply={setFilters}
        hideVerification={Boolean(lockedVerification)}
      />

      <ConfirmDialog
        open={approveTarget !== null}
        onOpenChange={(o) => !o && setApproveTarget(null)}
        title="Approve this camp?"
        description={
          approveTarget
            ? `"${approveTarget.name}" will be marked verified and shown in the public app.`
            : ""
        }
        confirmLabel="Approve"
        loading={approve.isPending}
        onConfirm={() => approveTarget && approve.mutate(approveTarget.id)}
      />

      <ConfirmDialog
        open={rejectTarget !== null}
        onOpenChange={(o) => !o && setRejectTarget(null)}
        title="Reject this camp?"
        description={
          rejectTarget
            ? `"${rejectTarget.name}" will stay unverified (hidden from the public app) and leave the reported queue.`
            : ""
        }
        confirmLabel="Reject"
        loading={reject.isPending}
        onConfirm={() => rejectTarget && reject.mutate(rejectTarget.id)}
      />

      <ConfirmDialog
        open={denyTarget !== null}
        onOpenChange={(o) => !o && setDenyTarget(null)}
        title="Deny this camp?"
        description={
          denyTarget
            ? `"${denyTarget.name}" will be permanently deleted. This cannot be undone.`
            : ""
        }
        confirmLabel="Deny & delete"
        destructive
        loading={deny.isPending}
        onConfirm={() => denyTarget && deny.mutate(denyTarget.id)}
      />
    </div>
  );
}

interface RowProps {
  camp: CampListItem;
  serial: number;
  districtName: Map<string, string>;
  actions: ActionsMode;
  approving: boolean;
  rejecting: boolean;
  /** Pending requirement requests for this camp. 0 renders nothing. */
  requirementCount: number;
  onOpen: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDeny: () => void;
}

/**
 * Pending-requirement bubble. Rendered inline beside the camp name rather than
 * as its own column, so the fixed GRID and the virtualizer's row height stay
 * untouched.
 */
function RequirementBubble({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      title={`${count} pending requirement request(s)`}
      className="grid size-5 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function ReviewActions({
  approving,
  rejecting,
  onApprove,
  onReject,
  onDeny,
}: {
  approving: boolean;
  rejecting: boolean;
  onApprove: () => void;
  onReject: () => void;
  onDeny: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={onApprove}
        disabled={approving}
        aria-label="Approve camp"
        title="Approve"
        className="inline-flex size-7 items-center justify-center rounded-md text-[#3fb950] transition-colors hover:bg-[#3fb950]/15 disabled:opacity-50"
      >
        {approving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
      </button>
      <button
        type="button"
        onClick={onReject}
        disabled={rejecting}
        aria-label="Reject camp"
        title="Reject"
        className="inline-flex size-7 items-center justify-center rounded-md text-[#d29922] transition-colors hover:bg-[#d29922]/15 disabled:opacity-50"
      >
        {rejecting ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
      </button>
      <button
        type="button"
        onClick={onDeny}
        aria-label="Delete camp"
        title="Delete"
        className="inline-flex size-7 items-center justify-center rounded-md text-[#f85149] transition-colors hover:bg-[#f85149]/15"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function TableRow({
  camp,
  serial,
  districtName,
  actions,
  approving,
  rejecting,
  onOpen,
  onApprove,
  onReject,
  requirementCount,
  onDeny,
  style,
}: RowProps & { style: React.CSSProperties }) {
  return (
    <div
      style={{ ...style, gridTemplateColumns: GRID }}
      onClick={onOpen}
      className="grid cursor-pointer items-center gap-4 border-b border-border/60 px-4 transition-colors hover:bg-secondary/40"
    >
      <span className="tabular-nums text-muted-foreground">{serial}</span>
      <span className="flex min-w-0 items-center gap-1.5 font-medium text-foreground">
        <span className="truncate">{camp.name}</span>
        {camp.verification_state === "verified" && (
          <BadgeCheck className="size-4 shrink-0 text-[#3fb950]" aria-label="Verified" />
        )}
        <RequirementBubble count={requirementCount} />
      </span>
      <span className="truncate text-muted-foreground">
        {districtName.get(camp.district_code) ?? camp.district_code}
      </span>
      <span className="truncate text-muted-foreground">{camp.taluk ?? "—"}</span>
      <span className="truncate text-muted-foreground">{camp.lsg_name ?? "—"}</span>
      <span className="truncate text-muted-foreground">—</span>
      <span className="truncate tabular-nums text-muted-foreground">
        {camp.camp_phone_primary ?? "—"}
      </span>
      {actions === "review" ? (
        <ReviewActions
          approving={approving}
          rejecting={rejecting}
          onApprove={onApprove}
          onReject={onReject}
          onDeny={onDeny}
        />
      ) : (
        <span className="flex justify-end text-muted-foreground">
          <RowChevron className="size-4" aria-hidden="true" />
        </span>
      )}
    </div>
  );
}

function CampCard({
  camp,
  serial,
  districtName,
  actions,
  approving,
  rejecting,
  onOpen,
  onApprove,
  onReject,
  onDeny,
  requirementCount,
}: RowProps) {
  const place = [
    districtName.get(camp.district_code) ?? camp.district_code,
    camp.taluk,
    camp.lsg_name,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      onClick={onOpen}
      className="flex cursor-pointer items-center gap-3 p-4 transition-colors hover:bg-secondary/40"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-foreground">{camp.name}</span>
          {camp.verification_state === "verified" && (
            <BadgeCheck className="size-4 shrink-0 text-[#3fb950]" aria-label="Verified" />
          )}
          <RequirementBubble count={requirementCount} />
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">{place}</p>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="tabular-nums">#{serial}</span>
          <span className="tabular-nums">{camp.camp_phone_primary ?? "No phone"}</span>
        </div>
      </div>
      {actions === "review" ? (
        <ReviewActions
          approving={approving}
          rejecting={rejecting}
          onApprove={onApprove}
          onReject={onReject}
          onDeny={onDeny}
        />
      ) : (
        <RowChevron className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
    </div>
  );
}

function BodySkeleton({ isDesktop }: { isDesktop: boolean }) {
  if (isDesktop) {
    return (
      <>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{ gridTemplateColumns: GRID, height: ROW_HEIGHT }}
            className="grid items-center gap-4 border-b border-border/60 px-4"
          >
            {COLUMNS.map((c) => (
              <span key={c} className="h-4 w-20 animate-pulse rounded bg-secondary" />
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
