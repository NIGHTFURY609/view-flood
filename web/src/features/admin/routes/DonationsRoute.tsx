import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { adminNeedsQuery } from "@/features/admin/api/adminRequirements";
import { NeedDonationRow } from "@/features/admin/components/NeedDonationRow";
import { districtsQuery } from "@/features/camps/api";
import type { AdminNeedsParams } from "@/features/admin/types";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { cn } from "@/shared/lib/cn";
import { NEED_ITEMS } from "@/shared/lib/needs";

const PAGE_SIZE = 25;
const ALL = "__all__";

export function DonationsRoute() {
  const [district, setDistrict] = useState("");
  const [item, setItem] = useState("");
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);

  const q = useDebouncedValue(searchText, 300);
  const districts = useQuery(districtsQuery());

  useEffect(() => {
    setPage(1);
  }, [district, item, q]);

  const params: AdminNeedsParams = {
    limit: PAGE_SIZE,
    ...(district ? { district_code: district } : {}),
    ...(item ? { item_key: item } : {}),
    ...(q ? { q } : {}),
    ...(page > 1 ? { cursor: String((page - 1) * PAGE_SIZE) } : {}),
  };

  const needs = useQuery(adminNeedsQuery(params));
  const rows = needs.data?.items ?? [];
  const total = needs.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isRefetching = needs.isFetching && !needs.isPending;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="grid shrink-0 gap-2 sm:grid-cols-3">
        <Select value={district || ALL} onValueChange={(v) => setDistrict(v === ALL ? "" : v)}>
          <SelectTrigger>
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
          <SelectTrigger>
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

        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search camp or item…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface">
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          {needs.isPending ? (
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
              No approved needs here.
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {rows.map((need) => (
                <NeedDonationRow key={need.id} need={need} />
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
            items
          </p>
          <div className="flex items-center gap-2">
            <PageButton
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              icon={ChevronRight}
              flip
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
  flip = false,
}: {
  onClick: () => void;
  disabled: boolean;
  icon: typeof ChevronRight;
  label: string;
  flip?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-muted-foreground"
    >
      <Icon className={cn("size-4", flip && "rotate-180")} aria-hidden="true" />
    </button>
  );
}
