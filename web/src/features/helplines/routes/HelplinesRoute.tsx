import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useSearchParams } from "react-router";

import { districtsQuery } from "@/features/camps/api";
import { EmergencyContacts } from "@/features/helplines/components/EmergencyContacts";
import { Breadcrumbs } from "@/shared/components/Breadcrumbs";
import { InfoTip } from "@/shared/components/InfoTip";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useI18n } from "@/shared/i18n";

const ALL = "__state__";

export function HelplinesRoute() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const districts = useQuery(districtsQuery());

  const district = searchParams.get("district") ?? "";

  useEffect(() => {
    document.title = `${t("help.title")} — ${t("app.name")}`;
  }, [t]);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Breadcrumbs items={[{ label: t("help.title") }]} />

      <div className="flex items-center gap-1">
        <h1 className="text-2xl font-bold text-foreground">{t("help.title")}</h1>
        <InfoTip label={t("help.note")} />
      </div>

      {/* The prototype never passed a districtCode here, so district-specific
          numbers were unreachable from this page. */}
      <div className="max-w-xs">
        <Label htmlFor="helpline-district" className="mb-1.5 block">
          {t("filter.district")}
        </Label>
        <Select
          value={district === "" ? ALL : district}
          onValueChange={(next) => {
            const params = new URLSearchParams(searchParams);
            if (next === ALL) params.delete("district");
            else params.set("district", next);
            setSearchParams(params, { replace: true });
          }}
        >
          <SelectTrigger id="helpline-district">
            <SelectValue placeholder={t("help.state")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("help.state")}</SelectItem>
            {(districts.data ?? []).map((d) => (
              <SelectItem key={d.code} value={d.code}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <EmergencyContacts {...(district ? { districtCode: district } : {})} />
    </div>
  );
}
