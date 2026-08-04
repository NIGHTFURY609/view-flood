import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  DoorClosed,
  DoorOpen,
  Landmark,
} from "lucide-react";
import type { ReactNode } from "react";

import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { stalenessOf } from "@/shared/lib/format";
import type { CampStatus, UrgencyLevel, VerificationState } from "@/shared/types/api";

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

export function StatusBadge({ status }: { status: CampStatus }) {
  const { t } = useI18n();
  const open = status === "active";

  return (
    <Pill className={open ? "bg-open-soft text-open" : "bg-closed-soft text-closed"}>
      {open ? (
        <DoorOpen className="size-3.5" aria-hidden="true" />
      ) : (
        <DoorClosed className="size-3.5" aria-hidden="true" />
      )}
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

export function UrgencyBadge({
  urgency,
  reportedOnly = false,
}: {
  urgency: UrgencyLevel;
  reportedOnly?: boolean;
}) {
  const { t } = useI18n();
  if (urgency === "normal") return null;

  const critical = urgency === "critical";

  return (
    <Pill className={critical ? "bg-critical-soft text-critical" : "bg-high-soft text-high"}>
      <AlertTriangle className="size-3.5" aria-hidden="true" />
      {critical ? t("urgency.critical") : t("urgency.high")}
      {reportedOnly ? (
        <span className="font-normal opacity-85">· {t("urgency.reported")}</span>
      ) : null}
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
