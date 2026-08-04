import { Skeleton } from "@/shared/components/ui/skeleton";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";

/**
 * Skeletons mirror the real layout closely enough that content does not jump
 * when it arrives. The container carries aria-busy so a screen reader announces
 * the load once, rather than reading dozens of empty bars.
 */

export function CampCardSkeleton() {
  return (
    <div className="panel flex flex-col gap-3 p-4">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="h-11 w-full rounded-lg" />
    </div>
  );
}

export function CampRowSkeleton() {
  return (
    <div className="panel flex items-center gap-3 p-3">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <Skeleton className="size-11 shrink-0 rounded-lg" />
    </div>
  );
}

export function CampListSkeleton({
  count = 6,
  view = "card",
}: {
  count?: number;
  view?: "card" | "list";
}) {
  const { t } = useI18n();

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      aria-label={t("list.loading")}
      className={cn(
        view === "list"
          ? "space-y-2"
          : "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3",
      )}
    >
      {Array.from({ length: count }, (_, i) =>
        view === "list" ? <CampRowSkeleton key={i} /> : <CampCardSkeleton key={i} />,
      )}
    </div>
  );
}

export function NeedsRowSkeleton() {
  return (
    <div className="panel flex items-center gap-3 p-3">
      <Skeleton className="size-9 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div aria-busy="true" className="space-y-4">
      <div className="panel space-y-3 p-4">
        <Skeleton className="h-7 w-2/3" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-56 w-full rounded-xl" />
      <div className="panel space-y-3 p-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}

/** Shown while a lazily-loaded route chunk is in flight. */
export function RouteFallback() {
  return (
    <div aria-busy="true" className="space-y-4 py-2">
      <Skeleton className="h-8 w-48" />
      <CampListSkeleton count={4} />
    </div>
  );
}
