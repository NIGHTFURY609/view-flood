import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  approveRequirement,
  rejectRequirement,
} from "@/features/admin/api/adminRequirements";
import { ConfirmDialog } from "@/features/admin/components/ConfirmDialog";
import type { AdminRequirement, AdminRequirementItem } from "@/features/admin/types";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/cn";
import { isCatalogueKey } from "@/shared/lib/needs";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-[#d29922]/15 text-[#d29922]",
  approved: "bg-[#3fb950]/15 text-[#3fb950]",
  rejected: "bg-[#f85149]/15 text-[#f85149]",
};

/** Titles the catalogue keys the same way the public app does, minus i18n. */
function itemName(item: AdminRequirementItem): string {
  if (!isCatalogueKey(item.item_key)) return item.label ?? item.item_key;
  return item.item_key.replace(/_/g, " ");
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

/**
 * One submitted request, with its line items and review actions.
 *
 * Approving upserts every item into camp_needs and is not reversible from here,
 * so both actions go through ConfirmDialog like the camp approve/reject flow.
 */
export function RequirementCard({
  requirement,
  showCamp = true,
}: {
  requirement: AdminRequirement;
  showCamp?: boolean;
}) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<"approve" | "reject" | null>(null);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin", "requirements"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "camp", requirement.camp_id] });
  }

  const approve = useMutation({
    mutationFn: () => approveRequirement(requirement.id),
    onSuccess: () => {
      toast.success("Request approved — items added to this camp's needs");
      setConfirming(null);
      refresh();
    },
    onError: () => toast.error("Could not approve that request"),
  });

  const reject = useMutation({
    mutationFn: () => rejectRequirement(requirement.id),
    onSuccess: () => {
      toast.success("Request rejected");
      setConfirming(null);
      refresh();
    },
    onError: () => toast.error("Could not reject that request"),
  });

  const busy = approve.isPending || reject.isPending;
  const pending = requirement.status === "pending";

  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {showCamp && (
            <p className="truncate text-sm font-semibold text-foreground">
              {requirement.camp_name ?? "Camp"}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {requirement.submitter_name} · {requirement.submitter_phone} ·{" "}
            {fmtDate(requirement.created_at)}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
            STATUS_STYLE[requirement.status] ?? "bg-secondary text-muted-foreground",
          )}
        >
          {requirement.status}
        </span>
      </div>

      <ul className="flex flex-wrap gap-1.5">
        {requirement.items.map((item) => (
          <li
            key={item.id}
            className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground"
          >
            <span className="font-semibold capitalize">{itemName(item)}</span>
            <span className="text-muted-foreground">
              {item.quantity.toLocaleString("en-IN")} {item.unit}
            </span>
          </li>
        ))}
      </ul>

      {requirement.note && (
        <p className="text-xs text-muted-foreground text-pretty">{requirement.note}</p>
      )}

      {pending && (
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={busy}
            onClick={() => setConfirming("approve")}
          >
            {approve.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            Approve
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setConfirming("reject")}
          >
            <X className="size-4" aria-hidden="true" />
            Reject
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirming === "approve"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Approve this request?"
        description={`${requirement.items.length} item(s) will be added to this camp's public needs. Quantities are added to whatever is already listed.`}
        confirmLabel="Approve"
        loading={approve.isPending}
        onConfirm={() => approve.mutate()}
      />

      <ConfirmDialog
        open={confirming === "reject"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Reject this request?"
        description="The request is closed and nothing is added to this camp's needs."
        confirmLabel="Reject"
        destructive
        loading={reject.isPending}
        onConfirm={() => reject.mutate()}
      />
    </li>
  );
}
