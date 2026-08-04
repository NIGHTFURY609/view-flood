import { AlertTriangle, DoorClosed, DoorOpen } from "lucide-react";

import { Field } from "@/features/report/components/steps/StepLocation";
import type { ReportDraft } from "@/features/report/schema";
import { Textarea } from "@/shared/components/ui/input";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";

const URGENCIES = ["normal", "high", "critical"] as const;

export function StepStatus({
  draft,
  update,
  errors,
}: {
  draft: ReportDraft;
  update: (patch: Partial<ReportDraft>) => void;
  errors: Record<string, string>;
}) {
  const { t } = useI18n();
  const needsReason = draft.reportedUrgency !== "normal";

  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-foreground">
          {t("report.isOpen")}
        </legend>
        <div className="flex gap-2">
          <Choice
            active={draft.reportedStatus === "active"}
            onClick={() => update({ reportedStatus: "active" })}
            tone="open"
          >
            <DoorOpen className="size-4" aria-hidden="true" />
            {t("report.yesOpen")}
          </Choice>
          <Choice
            active={draft.reportedStatus === "inactive"}
            onClick={() => update({ reportedStatus: "inactive" })}
            tone="closed"
          >
            <DoorClosed className="size-4" aria-hidden="true" />
            {t("report.noClosed")}
          </Choice>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-foreground">
          {t("report.urgency")}
        </legend>
        <div className="flex flex-wrap gap-2">
          {URGENCIES.map((urgency) => (
            <Choice
              key={urgency}
              active={draft.reportedUrgency === urgency}
              onClick={() => update({ reportedUrgency: urgency })}
              tone={urgency === "critical" ? "critical" : urgency === "high" ? "high" : "neutral"}
            >
              {urgency !== "normal" ? (
                <AlertTriangle className="size-4" aria-hidden="true" />
              ) : null}
              {urgency === "normal"
                ? t("common.no")
                : urgency === "high"
                  ? t("urgency.high")
                  : t("urgency.critical")}
            </Choice>
          ))}
        </div>
      </fieldset>

      {/* Raising an alarm requires saying why — the server enforces the same
          10-character floor, so this cannot be skipped by bypassing the UI. */}
      {needsReason ? (
        <Field
          id="report-urgency-reason"
          label={t("report.urgencyReason")}
          hint={t("report.urgencyReasonHint")}
          error={errors["reportedUrgencyReason"]}
        >
          <Textarea
            id="report-urgency-reason"
            value={draft.reportedUrgencyReason ?? ""}
            maxLength={500}
            onChange={(event) => update({ reportedUrgencyReason: event.target.value })}
            aria-invalid={Boolean(errors["reportedUrgencyReason"])}
          />
        </Field>
      ) : null}
    </div>
  );
}

function Choice({
  active,
  onClick,
  tone,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone: "open" | "closed" | "high" | "critical" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3",
        "text-sm font-semibold transition-colors duration-(--duration-fast)",
        !active && "border-input bg-surface text-muted-foreground hover:bg-secondary",
        active && tone === "open" && "border-open bg-open-soft text-open",
        active && tone === "closed" && "border-closed bg-closed-soft text-closed",
        active && tone === "high" && "border-high bg-high-soft text-high",
        active && tone === "critical" && "border-critical bg-critical-soft text-critical",
        active && tone === "neutral" && "border-accent bg-accent-soft text-accent",
      )}
    >
      {children}
    </button>
  );
}
