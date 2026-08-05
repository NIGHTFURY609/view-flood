import { Check, Loader2, MapPin, TriangleAlert } from "lucide-react";

import { useGeolocation } from "@/shared/hooks/useGeolocation";
import { useI18n } from "@/shared/i18n";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/cn";

/**
 * Shared "Use my location" control with a permission-aware state machine, so the
 * Camps list and the Report wizard show identical behaviour (single source).
 *
 *   idle    → outline button "Use my location"
 *   asking  → button with spinner "Locating…" (disabled)
 *   granted → quiet chip "Location on" (Check) — never blocks the rest of the UI
 *   denied  → muted line with a retry affordance
 */
export function LocationField({ className }: { className?: string }) {
  const { t } = useI18n();
  const { status, request } = useGeolocation();

  if (status === "granted") {
    return (
      <span
        className={cn(
          "inline-flex min-h-9 items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5",
          "text-sm font-semibold text-accent",
          className,
        )}
      >
        <Check className="size-4" aria-hidden="true" />
        {t("location.on")}
      </span>
    );
  }

  if (status === "denied") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <p className="text-xs text-unverified">{t("location.denied")}</p>
        <Button variant="ghost" size="sm" onClick={request}>
          {t("action.retry")}
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="md"
      onClick={request}
      disabled={status === "asking"}
      className={cn("self-start", className)}
    >
      {status === "asking" ? (
        <Loader2 className="size-4 animate-spin text-accent" aria-hidden="true" />
      ) : (
        <MapPin className="size-4 text-accent" aria-hidden="true" />
      )}
      {status === "asking" ? t("location.searching") : t("action.useLocation")}
    </Button>
  );
}

/** Small inline indicator for "location unavailable" without a retry button. */
export function LocationUnavailable({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground",
        className,
      )}
    >
      <TriangleAlert className="size-3.5" aria-hidden="true" />
      {t("location.unavailable")}
    </span>
  );
}
