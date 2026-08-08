import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, PhoneCall } from "lucide-react";
import { useState } from "react";

import { adminNeedPledgesQuery } from "@/features/admin/api/adminRequirements";
import type { AdminNeed } from "@/features/admin/types";
import { useI18n, type DictKey } from "@/shared/i18n";
import { displayPhone } from "@/shared/lib/format";
import { isCatalogueKey } from "@/shared/lib/needs";

/**
 * One approved need with its donation tally. Expanding it lazily loads the
 * individual pledges — including donor name and phone (admin-only PII). Shared
 * by the global Donations view and each camp's admin detail page.
 */
export function NeedDonationRow({
  need,
  showCamp = true,
}: {
  need: AdminNeed;
  showCamp?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const label = isCatalogueKey(need.item_key)
    ? t(`need.${need.item_key}` as DictKey)
    : (need.label ?? need.item_key);
  const remaining = Math.max(0, need.needed_qty - need.pledged_qty);
  const pledges = useQuery(adminNeedPledgesQuery(need.id, open));

  return (
    <li className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/50"
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {label}
            {showCamp && need.camp_name ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {need.camp_name}
              </span>
            ) : null}
          </span>
          <span className="block text-xs text-muted-foreground">
            {need.pledged_qty} / {need.needed_qty} {need.unit} pledged · {remaining} still needed ·{" "}
            {need.pledge_count} {need.pledge_count === 1 ? "donation" : "donations"}
          </span>
        </span>
      </button>

      {open ? (
        <div className="border-t border-border/60 bg-background/40 px-4 py-3 pl-11">
          {pledges.isPending ? (
            <div className="h-10 animate-pulse rounded bg-secondary" />
          ) : (pledges.data?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">No donations recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(pledges.data ?? []).map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
                >
                  <span className="font-medium text-foreground">{p.donor_name}</span>
                  <a
                    href={`tel:${p.donor_phone}`}
                    className="inline-flex items-center gap-1 text-accent hover:underline"
                  >
                    <PhoneCall className="size-3" aria-hidden="true" />
                    {displayPhone(p.donor_phone)}
                  </a>
                  <span className="tabular-nums">
                    {p.quantity} {need.unit}
                  </span>
                  {p.phone_verified ? (
                    <span className="rounded bg-verified-soft px-1.5 py-0.5 text-verified">
                      verified
                    </span>
                  ) : (
                    <span className="rounded bg-[#d29922]/15 px-1.5 py-0.5 text-[#d29922]">
                      phone unverified
                    </span>
                  )}
                  <span>{fmtDate(p.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </li>
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
