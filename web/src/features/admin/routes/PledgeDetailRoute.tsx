import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ExternalLink, Pencil, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import {
  adminPledgeQuery,
  unverifyPledge,
  verifyPledge,
} from "@/features/admin/api/adminRequirements";
import { isApiError } from "@/shared/api/errors";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { useI18n, type DictKey } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { displayPhone } from "@/shared/lib/format";
import { isCatalogueKey } from "@/shared/lib/needs";

function statusLabel(v: boolean | null): { text: string; className: string } {
  if (v === true) return { text: "Verified", className: "bg-[#3fb950]/15 text-[#3fb950]" };
  if (v === false) return { text: "Unverified", className: "bg-[#d29922]/15 text-[#d29922]" };
  return { text: "Pending", className: "bg-secondary text-muted-foreground" };
}

export function PledgeDetailRoute() {
  const { pledgeId = "" } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const pledge = useQuery(adminPledgeQuery(pledgeId));

  const setVerified = useMutation({
    mutationFn: (next: boolean) => (next ? verifyPledge(pledgeId) : unverifyPledge(pledgeId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "pledge", pledgeId] });
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

  const data = pledge.data;
  const label = data
    ? isCatalogueKey(data.item_key)
      ? t(`need.${data.item_key}` as DictKey)
      : (data.label ?? data.item_key)
    : "";
  const isVerified = data?.admin_verified === true;
  const isUnverified = data?.admin_verified === false;
  const status = statusLabel(data?.admin_verified ?? null);

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

        {pledge.isPending || !data ? (
          pledge.isError ? (
            <p className="text-sm text-critical">Could not load this donation.</p>
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
                <h2 className="text-lg font-semibold capitalize text-foreground">
                  {label} · {data.quantity} {data.unit}
                </h2>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                    status.className,
                  )}
                >
                  {status.text}
                </span>
              </div>
              {/* Editable here (unlike the list): the decision can be changed either
                  way, but only after entering edit mode. */}
              <div className="flex flex-wrap gap-2">
                {editing ? (
                  <>
                    <Button
                      variant={isVerified ? "primary" : "outline"}
                      size="sm"
                      disabled={setVerified.isPending || isVerified}
                      onClick={() => setVerified.mutate(true)}
                    >
                      <Check className="size-4" />
                      Verify
                    </Button>
                    <Button
                      variant={isUnverified ? "primary" : "outline"}
                      size="sm"
                      disabled={setVerified.isPending || isUnverified}
                      onClick={() => setVerified.mutate(false)}
                    >
                      <X className="size-4" />
                      Unverify
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                      Done
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <Section title="Donation">
                <Info label="Item" value={label} className="capitalize" />
                <Info label="Camp">
                  <Link
                    to={`/admin/camps/${data.camp_id}`}
                    className="inline-flex items-center gap-1 text-accent hover:underline"
                  >
                    {data.camp_name ?? data.camp_id}
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </Link>
                </Info>
                <Info label="Pledged" value={`${data.quantity} ${data.unit}`} />
                <Info label="Needed" value={`${data.needed_qty} ${data.unit}`} />
                <Info label="Review status" value={status.text} />
                <Info label="Counts toward camp" value={isVerified ? "Yes" : "No"} />
                <Info label="Received" value={fmtDate(data.created_at)} />
              </Section>

              <Section title="Donor">
                <Info label="Name" value={data.donor_name} />
                <Info label="Phone">
                  <a href={`tel:${data.donor_phone}`} className="text-accent hover:underline">
                    {displayPhone(data.donor_phone)}
                  </a>
                </Info>
                <Info label="Phone verified (OTP)" value={data.phone_verified ? "Yes" : "No"} />
              </Section>
            </div>
          </>
        )}
      </div>
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
