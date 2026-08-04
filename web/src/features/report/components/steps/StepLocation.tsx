import { useQuery } from "@tanstack/react-query";
import { Check, MapPin } from "lucide-react";
import { useMemo } from "react";

import { districtsQuery, lsgQuery, taluksQuery } from "@/features/camps/api";
import type { ReportDraft } from "@/features/report/schema";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useGeolocation } from "@/shared/hooks/useGeolocation";
import { useI18n } from "@/shared/i18n";

export function StepLocation({
  draft,
  update,
  errors,
}: {
  draft: ReportDraft;
  update: (patch: Partial<ReportDraft>) => void;
  errors: Record<string, string>;
}) {
  const { t } = useI18n();
  const { coords, status, request } = useGeolocation();

  const districts = useQuery(districtsQuery());
  const taluks = useQuery({
    ...taluksQuery(draft.districtCode || undefined),
    enabled: Boolean(draft.districtCode),
  });
  const lsgBodies = useQuery({
    ...lsgQuery(draft.districtCode || undefined),
    enabled: Boolean(draft.districtCode),
  });

  const lsgOptions = useMemo(
    () => [...new Set((lsgBodies.data ?? []).map((row) => row.name))].sort(),
    [lsgBodies.data],
  );

  const hasCoords = draft.latitude !== null && draft.longitude !== null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={() => {
            request();
            if (coords) {
              update({
                latitude: coords.lat,
                longitude: coords.lng,
                locationAccuracyM: Math.round(coords.accuracy),
                deviceLocationGranted: true,
              });
            }
          }}
          disabled={status === "asking"}
        >
          <MapPin className="size-4 text-accent" aria-hidden="true" />
          {status === "asking" ? t("report.locating") : t("action.useLocation")}
        </Button>

        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {hasCoords ? (
            <>
              <Check className="size-3.5 text-verified" aria-hidden="true" />
              {t("report.locationOk")}
            </>
          ) : (
            t("report.locationNone")
          )}
        </p>
      </div>

      <Field id="report-district" label={t("filter.district")} error={errors["districtCode"]}>
        <Select
          value={draft.districtCode}
          onValueChange={(next) => update({ districtCode: next, taluk: "", lsgName: "" })}
        >
          <SelectTrigger id="report-district">
            <SelectValue placeholder={t("common.select")} />
          </SelectTrigger>
          <SelectContent>
            {(districts.data ?? []).map((district) => (
              <SelectItem key={district.code} value={district.code}>
                {district.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field id="report-taluk" label={t("filter.taluk")} error={errors["taluk"]}>
        <Select
          value={draft.taluk}
          onValueChange={(next) => update({ taluk: next })}
          disabled={!draft.districtCode}
        >
          <SelectTrigger id="report-taluk">
            <SelectValue placeholder={t("common.select")} />
          </SelectTrigger>
          <SelectContent>
            {(taluks.data ?? []).map((taluk) => (
              <SelectItem key={taluk.id} value={taluk.name}>
                {taluk.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field id="report-lsg-type" label={t("filter.lsg")} error={errors["lsgType"]}>
        <Select
          value={draft.lsgType}
          onValueChange={(next) =>
            update({ lsgType: next as ReportDraft["lsgType"] })
          }
        >
          <SelectTrigger id="report-lsg-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="panchayat">Panchayat</SelectItem>
            <SelectItem value="municipality">Municipality</SelectItem>
            <SelectItem value="corporation">Corporation</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field id="report-lsg" label={t("filter.lsg")} error={errors["lsgName"]}>
        {/* Free text as well as a picker: a new camp may sit in an LSG that is
            not in the seeded list. */}
        <Input
          id="report-lsg"
          list="report-lsg-options"
          value={draft.lsgName}
          onChange={(event) => update({ lsgName: event.target.value })}
        />
        <datalist id="report-lsg-options">
          {lsgOptions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </Field>
    </div>
  );
}

export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block">
        {label}
      </Label>
      {children}
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-critical">
          {/* Errors are dictionary keys so the copy stays translatable. */}
          {t(error as Parameters<typeof t>[0])}
        </p>
      ) : null}
    </div>
  );
}
