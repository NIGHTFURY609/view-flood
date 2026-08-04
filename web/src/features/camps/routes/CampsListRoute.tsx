import { useQuery } from "@tanstack/react-query";
import { Filter, LayoutGrid, List, Map, MapPin, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { campsQuery } from "@/features/camps/api";
import { CampCard } from "@/features/camps/components/CampCard";
import {
  CampFilters,
  FiltersPanel,
} from "@/features/camps/components/CampFilters";
import { CampMap, type MapPoint } from "@/features/camps/components/CampMap";
import { CampRow } from "@/features/camps/components/CampRow";
import { Breadcrumbs } from "@/shared/components/Breadcrumbs";
import { Pagination } from "@/shared/components/Pagination";
import { WeatherPanel } from "@/shared/components/WeatherPanel";
import { SegmentedNav } from "@/shared/components/SegmentedNav";
import { CampListSkeleton } from "@/shared/components/Skeletons";
import { EmptyState, ErrorState } from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/shared/components/ui/sheet";
import { useGeolocation } from "@/shared/hooks/useGeolocation";
import {
  campListFilterSchema,
  useFilterParams,
  type CampListFilters,
} from "@/shared/hooks/useFilterParams";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { formatIst } from "@/shared/lib/format";
import type { CampsQueryParams } from "@/shared/api/client";

const PAGE_SIZE = 24;

export function CampsListRoute() {
  const { t } = useI18n();
  const { values, setValues, reset } = useFilterParams(campListFilterSchema);
  const { coords, status: geoStatus, request: requestLocation } = useGeolocation();

  useEffect(() => {
    document.title = `${t("list.title")} — ${t("app.name")}`;
  }, [t]);

  const params = useMemo<CampsQueryParams>(() => {
    const useCoords = coords && !values.district;
    const base: CampsQueryParams = {
      status: values.status,
      limit: PAGE_SIZE,
      cursor: values.page > 1 ? String((values.page - 1) * PAGE_SIZE) : "",
      sort: useCoords ? "distance" : "urgency",
    };
    return {
      ...base,
      ...(values.district ? { district_code: values.district } : {}),
      ...(values.taluk ? { taluk: values.taluk } : {}),
      ...(values.lsg ? { lsg_name: values.lsg } : {}),
      ...(values.q ? { q: values.q } : {}),
      ...(values.amenities ? { amenities: values.amenities } : {}),
      ...(values.verified ? { verified_only: true } : {}),
      ...(useCoords ? { lat: coords.lat, lng: coords.lng } : {}),
    };
  }, [values, coords]);

  const [showMap, setShowMap] = useState(false);

  const camps = useQuery(campsQuery(params));

  const items = camps.data?.items ?? [];
  const total = camps.data?.total ?? items.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Only camps with coordinates can be plotted; capped so a dense district
  // does not drop thousands of markers onto a phone.
  const mapPoints = useMemo<MapPoint[]>(
    () =>
      items
        .filter((camp) => camp.latitude !== null && camp.longitude !== null)
        .slice(0, 400)
        .map((camp) => ({
          id: camp.id,
          name: camp.name,
          lat: camp.latitude as number,
          lng: camp.longitude as number,
          tone:
            camp.report_count === 0 && camp.status !== "active"
              ? ("predesignated" as const)
              : camp.status === "active"
                ? ("active" as const)
                : ("inactive" as const),
        })),
    [items],
  );

  const handleFilterChange = (patch: Partial<CampListFilters>) => setValues(patch);

  const filters = (
    <CampFilters values={values} onChange={handleFilterChange} onReset={reset} />
  );

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs items={[{ label: t("crumb.camps") }]} />

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">{t("list.title")}</h1>
        {camps.isSuccess ? (
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground">
            {total.toLocaleString("en-IN")}
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMap((v) => !v)}
            aria-pressed={showMap}
          >
            <Map className="size-4" aria-hidden="true" />
            {showMap ? t("map.hide") : t("map.show")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void camps.refetch()}
            disabled={camps.isFetching}
          >
            <RefreshCw
              className={cn("size-4", camps.isFetching && "animate-spin")}
              aria-hidden="true"
            />
            {t("action.refresh")}
          </Button>
        </div>
      </div>

      {/* Honest freshness: when the data was actually fetched, not page-load time. */}
      {camps.dataUpdatedAt ? (
        <p className="-mt-2 text-xs text-muted-foreground">
          {t("freshness.fetched", { time: formatIst(camps.dataUpdatedAt) })}
        </p>
      ) : null}

      {/* Wraps rather than clips — at 360px the tabs, filter trigger and view
          toggle do not fit on one line. */}
      <div className="below-header -mx-3 flex flex-wrap items-center gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur sm:-mx-4 sm:px-4">
        <SegmentedNav
          ariaLabel={`${t("tab.camps")} / ${t("tab.requirements")}`}
          segments={[
            { to: "/", label: t("tab.camps"), end: true },
            { to: "/needs", label: t("tab.requirements") },
          ]}
        />

        <div className="ml-auto flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden">
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                {t("filter.title")}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" aria-describedby={undefined}>
              <SheetTitle>{t("filter.title")}</SheetTitle>
              {filters}
            </SheetContent>
          </Sheet>

          <div
            role="group"
            aria-label={`${t("view.card")} / ${t("view.list")}`}
            className="flex items-center rounded-lg border border-input"
          >
            <ViewToggle
              active={values.view === "card"}
              label={t("view.card")}
              onClick={() => setValues({ view: "card" }, { resetPage: false })}
            >
              <LayoutGrid className="size-4" aria-hidden="true" />
            </ViewToggle>
            <ViewToggle
              active={values.view === "list"}
              label={t("view.list")}
              onClick={() => setValues({ view: "list" }, { resetPage: false })}
            >
              <List className="size-4" aria-hidden="true" />
            </ViewToggle>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <FiltersPanel>{filters}</FiltersPanel>
        </aside>

        <div className="flex flex-col gap-3">
          {geoStatus !== "granted" ? (
            <Button
              variant="outline"
              size="md"
              onClick={requestLocation}
              disabled={geoStatus === "asking"}
              className="self-start"
            >
              <MapPin className="size-4 text-accent" aria-hidden="true" />
              {geoStatus === "asking" ? t("location.searching") : t("action.useLocation")}
            </Button>
          ) : null}
          {geoStatus === "denied" ? (
            <p className="text-xs text-unverified">{t("location.denied")}</p>
          ) : null}

          {showMap ? <CampMap points={mapPoints} /> : null}

          {coords ? (
            <WeatherPanel lat={coords.lat} lng={coords.lng} placeName={t("list.nearYou")} />
          ) : null}

          {camps.isPending ? (
            <CampListSkeleton view={values.view} count={6} />
          ) : camps.isError ? (
            <ErrorState error={camps.error} onRetry={() => void camps.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Filter className="size-6" aria-hidden="true" />}
              title={t("list.empty")}
              hint={t("list.emptyHint")}
              action={
                <Button variant="outline" size="sm" onClick={reset}>
                  {t("filter.reset")}
                </Button>
              }
            />
          ) : (
            <>
              <p className="sr-only" aria-live="polite">
                {t("list.showing", { shown: items.length, total })}
              </p>
              <div
                className={cn(
                  values.view === "list"
                    ? "space-y-2"
                    : "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3",
                )}
              >
                {items.map((camp) =>
                  values.view === "list" ? (
                    <CampRow key={camp.id} camp={camp} />
                  ) : (
                    <CampCard key={camp.id} camp={camp} />
                  ),
                )}
              </div>
              <Pagination
                page={values.page}
                pageCount={pageCount}
                onChange={(page) => {
                  setValues({ page }, { resetPage: false });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ViewToggle({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "inline-flex size-11 cursor-pointer items-center justify-center",
        "transition-colors duration-(--duration-fast) first:rounded-l-lg last:rounded-r-lg",
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}
