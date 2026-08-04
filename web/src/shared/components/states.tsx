import { AlertTriangle, Inbox, RefreshCw, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/shared/components/ui/button";
import { useI18n } from "@/shared/i18n";
import { isApiError } from "@/shared/api/errors";
import { cn } from "@/shared/lib/cn";

/**
 * Every list and detail surface has three explicit states: loading (skeletons),
 * empty, and error. The prototype had a bare centred "Loading…" paragraph and
 * nothing at all for the other two.
 */

export function EmptyState({
  title,
  hint,
  action,
  icon,
  className,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "panel flex flex-col items-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
        {icon ?? <Inbox className="size-6" aria-hidden="true" />}
      </span>
      <p className="text-base font-semibold text-foreground text-balance">{title}</p>
      {hint ? (
        <p className="max-w-sm text-sm text-muted-foreground text-balance">{hint}</p>
      ) : null}
      {action}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const offline = isApiError(error) && error.isOffline;

  return (
    <div
      role="alert"
      className={cn(
        "panel flex flex-col items-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-full bg-critical-soft text-critical">
        {offline ? (
          <WifiOff className="size-6" aria-hidden="true" />
        ) : (
          <AlertTriangle className="size-6" aria-hidden="true" />
        )}
      </span>
      <p className="text-base font-semibold text-foreground text-balance">
        {offline ? t("offline.title") : t("error.generic")}
      </p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-4" aria-hidden="true" />
          {t("action.retry")}
        </Button>
      ) : null}
    </div>
  );
}
