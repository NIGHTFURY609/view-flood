import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ExternalLink, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";

import {
  adminRequirementQuery,
  approveRequirement,
  rejectRequirement,
} from "@/features/admin/api/adminRequirements";
import { ConfirmDialog } from "@/features/admin/components/ConfirmDialog";
import type { AdminRequirementItem } from "@/features/admin/types";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/cn";
import { isCatalogueKey } from "@/shared/lib/needs";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-[#d29922]/15 text-[#d29922]",
  approved: "bg-[#3fb950]/15 text-[#3fb950]",
  rejected: "bg-[#f85149]/15 text-[#f85149]",
};

function itemName(item: AdminRequirementItem): string {
  if (!isCatalogueKey(item.item_key)) return item.label ?? item.item_key;
  return item.item_key.replace(/_/g, " ");
}

export function RequirementDetailRoute() {
  const { requirementId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const request = useQuery(adminRequirementQuery(requirementId));
  const [confirming, setConfirming] = useState<"approve" | "reject" | null>(null);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin", "requirement", requirementId] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "requirements"] });
    if (request.data) {
      void queryClient.invalidateQueries({ queryKey: ["admin", "camp", request.data.camp_id] });
    }
  }

  const approve = useMutation({
    mutationFn: () => approveRequirement(requirementId),
    onSuccess: () => {
      setConfirming(null);
      refresh();
    },
  });
  const reject = useMutation({
    mutationFn: () => rejectRequirement(requirementId),
    onSuccess: () => {
      setConfirming(null);
      refresh();
    },
  });

  const data = request.data;
  const pending = data?.status === "pending";

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl pb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </button>

        {request.isPending || !data ? (
          request.isError ? (
            <p className="text-sm text-critical">Could not load this request.</p>
          ) : (
            <div className="space-y-4">
              <div className="h-8 w-64 animate-pulse rounded bg-secondary" />
              <div className="h-40 animate-pulse rounded-xl bg-secondary" />
            </div>
          )
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <h2 className="text-lg font-semibold text-foreground">
                  {data.camp_name ?? "Camp"}
                </h2>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                    STATUS_STYLE[data.status] ?? "bg-secondary text-muted-foreground",
                  )}
                >
                  {data.status}
                </span>
              </div>
              {pending && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" size="sm" onClick={() => setConfirming("approve")}>
                    <Check className="size-4" />
                    Approve
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setConfirming("reject")}>
                    <X className="size-4" />
                    Reject
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <Section title="Request">
                <Info label="Camp">
                  <Link
                    to={`/admin/camps/${data.camp_id}`}
                    className="inline-flex items-center gap-1 text-accent hover:underline"
                  >
                    {data.camp_name ?? data.camp_id}
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </Link>
                </Info>
                <Info label="Requester" value={data.submitter_name} />
                <Info label="Phone">
                  <a href={`tel:${data.submitter_phone}`} className="text-accent hover:underline">
                    {data.submitter_phone}
                  </a>
                </Info>
                <Info label="Requested" value={fmtDate(data.created_at)} />
                <Info label="Status" value={data.status} className="capitalize" />
                <Info label="Reviewed" value={data.reviewed_at ? fmtDate(data.reviewed_at) : "—"} />
                {data.note ? <Info label="Note" value={data.note} className="col-span-2" /> : null}
                {data.review_note ? (
                  <Info label="Review note" value={data.review_note} className="col-span-2" />
                ) : null}
              </Section>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Items requested</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border/60">
                    {data.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 px-5 py-3"
                      >
                        <span className="truncate text-sm font-medium capitalize text-foreground">
                          {itemName(item)}
                        </span>
                        <span className="shrink-0 tabular-nums text-sm text-muted-foreground">
                          {item.quantity.toLocaleString("en-IN")} {item.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirming === "approve"}
        onOpenChange={(o) => !o && setConfirming(null)}
        title="Approve this request?"
        description={
          data
            ? `${data.items.length} item(s) will be added to "${data.camp_name}"'s public needs. Quantities are added to whatever is already listed.`
            : ""
        }
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
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">{children}</dl>
      </CardContent>
    </Card>
  );
}

function Info({
  label,
  value,
  children,
  className,
}: {
  label: string;
  value?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-foreground">
        {children ?? value ?? "—"}
      </dd>
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
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}
