import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import {
  adminPledgesQuery,
  unverifyPledge,
  verifyPledge,
} from "@/features/admin/api/adminRequirements";
import { districtsQuery } from "@/features/camps/api";
import type { AdminPledgeRow, AdminPledgesParams } from "@/features/admin/types";
import { isApiError } from "@/shared/api/errors";
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
import { useI18n, type DictKey } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { displayPhone } from "@/shared/lib/format";
import { isCatalogueKey, NEED_ITEMS } from "@/shared/lib/needs";

const PAGE_SIZE = 25;
const ALL = "__all__";
const GRID =
  "44px minmax(0,1.2fr) minmax(0,1.4fr) 68px 68px minmax(0,1.1fr) minmax(0,1.2fr) minmax(0,1.1fr) 128px";
const COLUMNS = [
  "Sl No",
  "Item",
  "Camp",
  "Needed",
  "Pledged",
  "Name",
  "Phone",
  "Timestamp",
  "Action",
] as const;

export function DonationsRoute() {
  const isDesktop = useIsDesktop();
  const [district, setDistrict] = useState("");
  const [item, setItem] = useState("");
  const [verified, setVerified] = useState<"" | "verified" | "unverified" | "pending">("");
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);

  const q = useDebouncedValue(searchText, 300);
  const districts = useQuery(districtsQuery());

  useEffect(() => {
    setPage(1);
  }, [district, item, verified, q]);

  const params: AdminPledgesParams = {
    limit: PAGE_SIZE,
    ...(district ? { district_code: district } : {}),
    ...(item ? { item_key: item } : {}),
    ...(verified ? { verified } : {}),
    ...(q ? { q } : {}),
    ...(page > 1 ? { cursor: String((page - 1) * PAGE_SIZE) } : {}),
  };

  const pledges = useQuery(adminPledgesQuery(params));
  const rows = pledges.data?.items ?? [];
  const total = pledges.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);
  const isRefetching = pledges.isFetching && !pledges.isPending;
  const fmt = (n: number) => n.toLocaleString("en-IN");

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap gap-2">
        <Select value={district || ALL} onValueChange={(v) => setDistrict(v === ALL ? "" : v)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All districts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All districts</SelectItem>
            {(districts.data ?? []).map((d) => (
              <SelectItem key={d.code} value={d.code}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={item || ALL} onValueChange={(v) => setItem(v === ALL ? "" : v)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="All items" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All items</SelectItem>
            {NEED_ITEMS.map((it) => (
              <SelectItem key={it.key} value={it.key}>
                {it.key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={verified || ALL}
          onValueChange={(v) =>
            setVerified(v === ALL ? "" : (v as "verified" | "unverified" | "pending"))
          }
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="unverified">Unverified</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative min-w-0 flex-1 sm:ml-auto sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search camp, donor or phone…"
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
          {pledges.isPending ? (
            <BodySkeleton isDesktop={isDesktop} />
          ) : rows.length === 0 ? (
            <div className="grid h-full place-items-center py-12 text-sm text-muted-foreground">
              No donations here.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {rows.map((pledge, i) => (
                <PledgeRow
                  key={pledge.id}
                  pledge={pledge}
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

function PledgeRow({
  pledge,
  serial,
  isDesktop,
}: {
  pledge: AdminPledgeRow;
  serial: number;
  isDesktop: boolean;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const label = isCatalogueKey(pledge.item_key)
    ? t(`need.${pledge.item_key}` as DictKey)
    : (pledge.label ?? pledge.item_key);
  const open = () => navigate(`/admin/requirements/donations/${pledge.id}`);

  const setVerified = useMutation({
    mutationFn: (next: boolean) => (next ? verifyPledge(pledge.id) : unverifyPledge(pledge.id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "pledges"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "needs"] });
    },
    onError: (cause) => {
      if (isApiError(cause) && cause.code === "exceeds_remaining") {
        toast.error(cause.message);
        return;
      }
      toast.error("Could not update this donation");
    },
  });

  const action = (
    <PledgeAction
      pledge={pledge}
      pending={setVerified.isPending}
      onVerify={() => setVerified.mutate(true)}
      onUnverify={() => setVerified.mutate(false)}
    />
  );

  if (isDesktop) {
    return (
      <div
        style={{ gridTemplateColumns: GRID }}
        onClick={open}
        className="grid cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-secondary/40"
      >
        <span className="tabular-nums text-muted-foreground">{serial}</span>
        <span className="capitalize text-foreground">{label}</span>
        <span className="text-muted-foreground">{pledge.camp_name ?? "—"}</span>
        <span className="tabular-nums text-muted-foreground">
          {pledge.needed_qty} {pledge.unit}
        </span>
        <span className="tabular-nums font-medium text-foreground">
          {pledge.quantity} {pledge.unit}
        </span>
        <span className="text-muted-foreground">{pledge.donor_name}</span>
        <span className="whitespace-nowrap tabular-nums text-muted-foreground">
          {displayPhone(pledge.donor_phone)}
        </span>
        <span className="text-muted-foreground">{fmtDate(pledge.created_at)}</span>
        {action}
      </div>
    );
  }

  return (
    <div
      onClick={open}
      className="flex cursor-pointer items-start gap-3 p-4 transition-colors hover:bg-secondary/40"
    >
      <div className="min-w-0 flex-1">
        <span className="block font-medium text-foreground">
          <span className="capitalize">{label}</span>{" "}
          <span className="tabular-nums text-muted-foreground">
            · {pledge.quantity} {pledge.unit}
          </span>
        </span>
        <p className="mt-1 text-xs text-muted-foreground">{pledge.camp_name ?? "—"}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {pledge.donor_name} · {displayPhone(pledge.donor_phone)}
        </p>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="tabular-nums">#{serial}</span>
          <span className="tabular-nums">
            need {pledge.needed_qty} {pledge.unit}
          </span>
          <span>{fmtDate(pledge.created_at)}</span>
        </div>
      </div>
      {action}
    </div>
  );
}

/**
 * Pending donations (admin_verified null) offer both ✓ verify and ✗ unverify.
 * The choice is final: once decided the cell just shows the outcome as text
 * ("Verified" / "Unverified") with no way back. Verifying counts the pledge
 * toward the camp's needs; unverifying leaves it out.
 */
function PledgeAction({
  pledge,
  pending,
  onVerify,
  onUnverify,
}: {
  pledge: AdminPledgeRow;
  pending: boolean;
  onVerify: () => void;
  onUnverify: () => void;
}) {
  if (pledge.admin_verified === true) {
    return (
      <span className="flex items-center justify-end gap-1 text-sm font-semibold text-[#3fb950]">
        <Check className="size-4" aria-hidden="true" />
        Verified
      </span>
    );
  }
  if (pledge.admin_verified === false) {
    return (
      <span className="flex items-center justify-end gap-1 text-sm font-semibold text-[#d29922]">
        <X className="size-4" aria-hidden="true" />
        Unverified
      </span>
    );
  }
  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={onVerify}
        disabled={pending}
        aria-label="Verify donation"
        title="Verify — counts toward the camp's needs"
        className="inline-flex size-7 items-center justify-center rounded-md bg-[#3fb950]/10 text-[#3fb950] transition-colors hover:bg-[#3fb950]/25 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Check className="size-4" aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        onClick={onUnverify}
        disabled={pending}
        aria-label="Unverify donation"
        title="Unverify — leaves it out of the camp's needs"
        className="inline-flex size-7 items-center justify-center rounded-md bg-[#d29922]/10 text-[#d29922] transition-colors hover:bg-[#d29922]/25 disabled:opacity-50"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
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
            style={{ gridTemplateColumns: GRID }}
            className="grid items-center gap-4 border-b border-border/60 px-4 py-3"
          >
            {COLUMNS.map((c) => (
              <span key={c} className="h-4 w-14 animate-pulse rounded bg-secondary" />
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
