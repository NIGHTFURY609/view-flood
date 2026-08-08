import { useQuery } from "@tanstack/react-query";
import { PackageSearch } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Link } from "react-router";

import { districtsQuery } from "@/features/camps/api";
import { needsListQuery } from "@/features/needs/api";
import { Breadcrumbs } from "@/shared/components/Breadcrumbs";
import { Pagination } from "@/shared/components/Pagination";
import { SegmentedNav } from "@/shared/components/SegmentedNav";
import { NeedsRowSkeleton } from "@/shared/components/Skeletons";
import { EmptyState, ErrorState } from "@/shared/components/states";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { needsFilterSchema, useFilterParams } from "@/shared/hooks/useFilterParams";
import { useI18n, type DictKey } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { isCatalogueKey, NEED_ITEMS, needIcon } from "@/shared/lib/needs";

const PAGE_SIZE = 30;
const ALL = "__all__";

export function NeedsRoute() {
  const { t } = useI18n();
  const { values, setValues } = useFilterParams(needsFilterSchema);
  const districts = useQuery(districtsQuery());

  useEffect(() => {
    document.title = `${t("tab.requirements")} — ${t("app.name")}`;
  }, [t]);

  const params = useMemo(
    () => ({
      limit: PAGE_SIZE,
      cursor: values.page > 1 ? String((values.page - 1) * PAGE_SIZE) : "",
      ...(values.district ? { district_code: values.district } : {}),
      ...(values.item ? { item_key: values.item } : {}),
    }),
    [values],
  );

  const needs = useQuery(needsListQuery(params));
  const items = needs.data?.items ?? [];
  const total = needs.data?.total ?? items.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs items={[{ label: t("tab.requirements") }]} />

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">{t("need.title")}</h1>
        {needs.isSuccess ? (
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground">
            {total.toLocaleString("en-IN")}
          </span>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground text-pretty">{t("need.disclaimer")}</p>

      <div className="below-header -mx-3 border-b border-border bg-background/95 px-3 py-2 backdrop-blur sm:-mx-4 sm:px-4">
        <SegmentedNav
          ariaLabel={`${t("tab.camps")} / ${t("tab.requirements")}`}
          segments={[
            { to: "/", label: t("tab.camps"), end: true },
            { to: "/needs", label: t("tab.requirements") },
          ]}
        />
      </div>

      {/* Same URL-driven filter hook as the camps list — refresh and share work. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <div>
          <Label htmlFor="needs-district" className="mb-1.5 block">
            {t("filter.district")}
          </Label>
          <Select
            value={values.district === "" ? ALL : values.district}
            onValueChange={(next) => setValues({ district: next === ALL ? "" : next })}
          >
            <SelectTrigger id="needs-district">
              <SelectValue placeholder={t("filter.allDistricts")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("filter.allDistricts")}</SelectItem>
              {(districts.data ?? []).map((d) => (
                <SelectItem key={d.code} value={d.code}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="needs-item" className="mb-1.5 block">
            {t("filter.item")}
          </Label>
          <Select
            value={values.item === "" ? ALL : values.item}
            onValueChange={(next) => setValues({ item: next === ALL ? "" : next })}
          >
            <SelectTrigger id="needs-item">
              <SelectValue placeholder={t("needs.allItems")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("needs.allItems")}</SelectItem>
              {NEED_ITEMS.map((item) => (
                <SelectItem key={item.key} value={item.key}>
                  {t(`need.${item.key}` as DictKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {needs.isPending ? (
        <div aria-busy="true" className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <NeedsRowSkeleton key={i} />
          ))}
        </div>
      ) : needs.isError ? (
        <ErrorState error={needs.error} onRetry={() => void needs.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="size-6" aria-hidden="true" />}
          title={t("list.requirementsEmpty")}
          hint={t("list.emptyHint")}
        />
      ) : (
        <>
          <ul className="space-y-2">
            {items.map((need) => {
              const Icon = needIcon(need.item_key);
              const remaining = Math.max(0, need.needed_qty - need.pledged_qty);
              const progress =
                need.needed_qty > 0
                  ? Math.min(100, Math.round((need.pledged_qty / need.needed_qty) * 100))
                  : 0;

              return (
                <li key={need.id}>
                  <Link
                    to={`/camps/${need.camp_id}`}
                    className="panel flex items-center gap-3 p-3 transition-colors duration-(--duration-fast) hover:bg-secondary/50"
                  >
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-lg",
                        "bg-secondary text-secondary-foreground",
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {isCatalogueKey(need.item_key)
                          ? t(`need.${need.item_key}` as DictKey)
                          : (need.label ?? need.item_key)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t("need.progress", {
                          pledged: need.pledged_qty,
                          needed: need.needed_qty,
                          unit: need.unit,
                        })}
                      </span>
                      <span
                        role="progressbar"
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      >
                        <span
                          className="block h-full rounded-full bg-verified"
                          style={{ width: `${progress}%` }}
                        />
                      </span>
                    </span>

                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                        "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {t("need.remaining", { count: remaining, unit: need.unit })}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

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
  );
}
