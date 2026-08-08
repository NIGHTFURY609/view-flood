import {
  CheckCircle2,
  CircleAlert,
  Landmark,
} from "lucide-react";
import type { ReactNode } from "react";

import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { stalenessOf } from "@/shared/lib/format";
import type { CampStatus, VerificationState } from "@/shared/types/api";

/**
 * The trust vocabulary. Every badge pairs colour with an icon AND a text label,
 * so meaning never depends on colour alone (WCAG 1.4.1).
 *
 * Text sizes here are `text-xs` (12px) — the documented floor. The prototype
 * used text-[0.7rem] (11.2px) on tinted backgrounds.
 */

const PILL = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold leading-5";

function Pill({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn(PILL, className)}>{children}</span>;
}

export function VerificationBadge({
  state,
  full = false,
}: {
  state: VerificationState;
  full?: boolean;
}) {
  const { t } = useI18n();
  const verified = state === "verified";

  return (
    <Pill
      className={
        verified
          ? "bg-verified-soft text-verified"
          : "bg-unverified-soft text-unverified ring-1 ring-unverified/30"
      }
    >
      {verified ? (
        <CheckCircle2 className="size-3.5" aria-hidden="true" />
      ) : (
        <CircleAlert className="size-3.5" aria-hidden="true" />
      )}
      {verified
        ? t(full ? "state.verified" : "state.verified.short")
        : t(full ? "state.unverified" : "state.unverified.short")}
    </Pill>
  );
}

/**
 * A status dot: filled = open/active, hollow ring = closed. Carries the meaning
 * via SHAPE as well as colour, so the open/closed distinction survives for
 * colour-blind users (WCAG 1.4.1).
 */
function StatusDot({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-2.5 rounded-full",
        open ? "bg-current" : "border-2 border-current bg-transparent",
      )}
    />
  );
}

export function StatusBadge({ status }: { status: CampStatus }) {
  const { t } = useI18n();
  const open = status === "active";

  return (
    <Pill className={open ? "bg-open-soft text-open" : "bg-closed-soft text-closed"}>
      <StatusDot open={open} />
      {open ? t("status.active") : t("status.inactive")}
    </Pill>
  );
}

/**
 * A row from the government monsoon-camp sheet that nobody has reported on yet.
 * Labelled "Government list", never "official" — PRD §7 trust guardrail.
 */
export function isPreDesignated(camp: {
  readonly report_count: number;
  readonly status: CampStatus;
}): boolean {
  return camp.report_count === 0 && camp.status !== "active";
}

export function PreDesignatedBadge() {
  const { t } = useI18n();
  return (
    <Pill className="bg-secondary text-secondary-foreground">
      <Landmark className="size-3.5" aria-hidden="true" />
      {t("state.predesignated")}
    </Pill>
  );
}

/** Silent while fresh; escalates in weight as the confirmation ages past 24h / 72h. */
export function StalenessNote({ lastConfirmedAt }: { lastConfirmedAt: string | null }) {
  const { t } = useI18n();
  const staleness = stalenessOf(lastConfirmedAt);
  if (staleness === "fresh" || staleness === "never") return null;

  return (
    <span
      className={cn(
        "text-xs",
        staleness === "warning" ? "font-semibold text-critical" : "text-unverified",
      )}
    >
      {staleness === "warning" ? t("detail.veryStale") : t("detail.stale")}
    </span>
  );
}
