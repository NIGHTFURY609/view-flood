import { useQuery } from "@tanstack/react-query";
import { ChevronDown, MapPin, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { districtsQuery, lsgQuery, taluksQuery } from "@/features/camps/api";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import {
  parseAmenities,
  toggleAmenity,
  type CampListFilters,
} from "@/shared/hooks/useFilterParams";
import { useI18n, type DictKey } from "@/shared/i18n";
import { AMENITIES } from "@/shared/lib/amenities";
import { cn } from "@/shared/lib/cn";

const ALL = "__all__";

// "Government list" is deliberately absent: the pre-designated sheet is no
// longer a data source, so that option would always return nothing.
const STATUS_OPTIONS: ReadonlyArray<{ value: CampListFilters["status"]; labelKey: DictKey }> = [
  { value: "active", labelKey: "filter.statusActive" },
  { value: "inactive", labelKey: "filter.statusInactive" },
  { value: "all", labelKey: "filter.statusAll" },
];

export interface CampFiltersProps {
  readonly values: CampListFilters;
  readonly onChange: (patch: Partial<CampListFilters>) => void;
  readonly onReset: () => void;
  /** Active when the user granted "Use my location" — rendered as a removable filter. */
  readonly locationActive?: boolean;
  readonly onClearLocation?: () => void;
}

export function CampFilters({
  values,
  onChange,
  onReset,
  locationActive = false,
  onClearLocation,
}: CampFiltersProps) {
  const { t } = useI18n();

  // Local text state so typing does not push one history entry per keystroke.
  const [search, setSearch] = useState(values.q);
  const debouncedSearch = useDebouncedValue(search, 350);

  useEffect(() => {
    setSearch(values.q);
  }, [values.q]);

  useEffect(() => {
    if (debouncedSearch !== values.q) onChange({ q: debouncedSearch });
    // `values.q` is intentionally excluded: including it would fight the sync above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const districts = useQuery(districtsQuery());
  const taluks = useQuery({
    ...taluksQuery(values.district || undefined),
    enabled: Boolean(values.district),
  });
  const lsgBodies = useQuery({
    ...lsgQuery(values.district || undefined),
    enabled: Boolean(values.district),
  });

  const talukOptions = useMemo(
    () => (taluks.data ?? []).map((row) => row.name).sort((a, b) => a.localeCompare(b)),
    [taluks.data],
  );

  const lsgOptions = useMemo(() => {
    const rows = lsgBodies.data ?? [];
    // taluk_name is null for ~98% of seeded rows, so cascading off the selected
    // taluk would empty the list. Narrow only where the data actually supports
    // it, and otherwise show every LSG in the district.
    const narrowed =
      values.taluk && rows.some((r) => r.taluk_name)
        ? rows.filter((r) => !r.taluk_name || r.taluk_name === values.taluk)
        : rows;
    return [...new Set(narrowed.map((row) => row.name))].sort((a, b) => a.localeCompare(b));
  }, [lsgBodies.data, values.taluk]);

  const selectedAmenities = parseAmenities(values.amenities);

  // Selecting a district/taluk/LSG is incompatible with "my location" (distance
  // sort against a fixed point). Override: clear the location filter so the
  // two scopes can never silently conflict.
  const pickLocation = (patch: Partial<CampListFilters> & Record<string, string>) => {
    if (locationActive && onClearLocation) onClearLocation();
    onChange(patch);
  };

  const isDirty =
    values.district !== "" ||
    values.taluk !== "" ||
    values.lsg !== "" ||
    values.q !== "" ||
    values.amenities !== "" ||
    values.verified ||
    values.status !== "active";

  return (
    <div className="flex flex-col gap-4">
      {locationActive ? (
        <div className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-accent bg-accent/10 px-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
            <MapPin className="size-4 text-accent" aria-hidden="true" />
            {t("filter.myLocation")}
          </span>
          <button
            type="button"
            onClick={onClearLocation}
            aria-label={t("filter.removeLocation")}
            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-(--duration-fast) hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div>
        <Label htmlFor="camp-search" className="mb-1.5 block">
          {t("filter.search")}
        </Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="camp-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("filter.search")}
            className="pl-9"
          />
        </div>
      </div>

      <FilterSelect
        id="filter-district"
        label={t("filter.district")}
        placeholder={t("filter.allDistricts")}
        value={values.district}
        options={(districts.data ?? []).map((d) => ({ value: d.code, label: d.name }))}
        onChange={(next) => pickLocation({ district: next, taluk: "", lsg: "" })}
      />

      <FilterSelect
        id="filter-taluk"
        label={t("filter.taluk")}
        placeholder={t("filter.allTaluks")}
        value={values.taluk}
        disabled={!values.district}
        options={talukOptions.map((name) => ({ value: name, label: name }))}
        onChange={(next) => pickLocation({ taluk: next, lsg: "" })}
      />

      <FilterSelect
        id="filter-lsg"
        label={t("filter.lsg")}
        placeholder={t("filter.allLsg")}
        value={values.lsg}
        disabled={!values.district}
        options={lsgOptions.map((name) => ({ value: name, label: name }))}
        onChange={(next) => pickLocation({ lsg: next })}
      />

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-foreground">
          {t("filter.status")}
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((option) => {
            const active = values.status === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ status: option.value })}
                className={cn(
                  "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center",
                  "rounded-lg border px-3",
                  "text-xs font-semibold transition-colors duration-(--duration-fast)",
                  active
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-input bg-surface text-foreground hover:bg-secondary",
                )}
              >
                {t(option.labelKey)}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* The label is part of the hit area, so the effective target is 44px tall
          rather than the 20px visual box. */}
      <Label
        htmlFor="filter-verified"
        className="flex min-h-11 cursor-pointer items-center gap-2.5"
      >
        <Checkbox
          id="filter-verified"
          checked={values.verified}
          onCheckedChange={(checked) => onChange({ verified: checked === true })}
        />
        {t("filter.verifiedOnly")}
      </Label>

      <fieldset>
        <legend className="text-sm font-medium text-foreground">{t("filter.amenities")}</legend>
        <p className="mb-2 mt-0.5 text-xs text-muted-foreground">{t("filter.amenitiesHint")}</p>
        <div className="flex flex-wrap gap-1.5">
          {AMENITIES.map(({ key, icon: Icon }) => {
            const active = selectedAmenities.includes(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ amenities: toggleAmenity(values.amenities, key) })}
                className={cn(
                  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5",
                  "text-xs font-medium transition-colors duration-(--duration-fast)",
                  active
                    ? "border-verified bg-verified-soft text-verified"
                    : "border-input bg-surface text-foreground hover:bg-secondary",
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {t(`amenity.${key}` as DictKey)}
              </button>
            );
          })}
        </div>
      </fieldset>

      {isDirty ? (
        <Button variant="ghost" size="sm" onClick={onReset} className="self-start">
          <X className="size-4" aria-hidden="true" />
          {t("filter.reset")}
        </Button>
      ) : null}
    </div>
  );
}

function FilterSelect({
  id,
  label,
  placeholder,
  value,
  options,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block">
        {label}
      </Label>
      <Select
        value={value === "" ? ALL : value}
        onValueChange={(next) => onChange(next === ALL ? "" : next)}
        disabled={disabled}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Collapsible wrapper used for the desktop sidebar. */
export function FiltersPanel({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);

  return (
    <div className="panel overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 px-4 text-sm font-bold text-foreground"
      >
        {t("filter.title")}
        <ChevronDown
          className={cn(
            "size-4 transition-transform duration-(--duration-base)",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      {open ? <div className="border-t border-border p-4">{children}</div> : null}
    </div>
  );
}
