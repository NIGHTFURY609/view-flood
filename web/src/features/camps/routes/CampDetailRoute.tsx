import { useQuery } from "@tanstack/react-query";
import { MapPin, Navigation, Phone, ScrollText, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import { campNeedsQuery, campQuery } from "@/features/camps/api";
import { CampMap } from "@/features/camps/components/CampMap";
import { CampPhotos } from "@/features/camps/components/CampPhotos";
import { DonateDialog } from "@/features/needs/components/DonateDialog";
import { EmergencyContacts } from "@/features/helplines/components/EmergencyContacts";
import { Breadcrumbs } from "@/shared/components/Breadcrumbs";
import { CheckInCard } from "@/shared/components/CheckInCard";
import { DetailSkeleton } from "@/shared/components/Skeletons";
import { EmptyState, ErrorState } from "@/shared/components/states";
import {
  isPreDesignated,
  PreDesignatedBadge,
  StalenessNote,
  StatusBadge,
  UrgencyBadge,
  VerificationBadge,
} from "@/shared/components/badges";
import { Button } from "@/shared/components/ui/button";
import { useI18n, type DictKey } from "@/shared/i18n";
import { amenityIcon } from "@/shared/lib/amenities";
import { cn } from "@/shared/lib/cn";
import { googleMapsHref } from "@/shared/lib/maps";
import { displayPhone, formatIst } from "@/shared/lib/format";
import { needIcon } from "@/shared/lib/needs";

export function CampDetailRoute() {
  const { t, tp } = useI18n();
  const { campId = "" } = useParams();

  const [donating, setDonating] = useState<string | null>(null);

  const camp = useQuery({ ...campQuery(campId), enabled: campId !== "" });
  const needs = useQuery({ ...campNeedsQuery(campId), enabled: campId !== "" });

  const campName = camp.data?.name;

  // Fixes the prototype's shared generic title on every camp page.
  useEffect(() => {
    document.title = campName ? `${campName} — ${t("app.name")}` : t("app.name");
    return () => {
      document.title = t("app.name");
    };
  }, [campName, t]);

  if (camp.isPending) return <DetailSkeleton />;
  if (camp.isError) return <ErrorState error={camp.error} onRetry={() => void camp.refetch()} />;

  const data = camp.data;
  if (!data) return <EmptyState title={t("detail.notFound")} />;

  const preDesignated = isPreDesignated(data);
  const unverified = data.verification_state !== "verified";
  const phones = [data.camp_phone_primary, data.camp_phone_secondary].filter(
    (p): p is string => Boolean(p),
  );

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: t("crumb.camps"), to: "/" },
          ...(data.taluk ? [{ label: data.taluk }] : []),
          { label: data.name },
        ]}
      />

      <header className="panel flex flex-col gap-3 p-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground text-pretty">{data.name}</h1>
          {data.name_ml ? (
            <p lang="ml" className="text-base text-muted-foreground">
              {data.name_ml}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <VerificationBadge state={data.verification_state} full />
          {preDesignated ? <PreDesignatedBadge /> : <StatusBadge status={data.status} />}
          <UrgencyBadge urgency={data.urgency} />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-xs text-muted-foreground">
            {t("detail.lastConfirmed")}:{" "}
            {data.status_last_confirmed_at
              ? formatIst(data.status_last_confirmed_at)
              : t("detail.neverConfirmed")}
          </span>
          <StalenessNote lastConfirmedAt={data.status_last_confirmed_at} />
        </div>
      </header>

      {/* GUARD: never dismissible on an unverified or unreported camp. */}
      <div
        className={cn(
          "rounded-xl border px-4 py-3 text-sm font-medium text-pretty",
          unverified || preDesignated
            ? "border-unverified/40 bg-unverified-soft text-unverified"
            : "border-border bg-secondary text-secondary-foreground",
        )}
      >
        {preDesignated
          ? t("state.predesignatedNote")
          : unverified
            ? t("detail.callBeforeUnverified")
            : t("detail.callBefore")}
      </div>

      <section className="panel flex flex-col gap-3 p-4">
        <h2 className="text-base font-bold text-foreground">{t("detail.contact")}</h2>
        {data.camp_incharge_name ? (
          <p className="text-sm text-muted-foreground">
            {t("detail.incharge")}: <span className="text-foreground">{data.camp_incharge_name}</span>
          </p>
        ) : null}

        {phones.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {phones.map((phone) => (
              <li key={phone}>
                <a
                  href={`tel:${phone}`}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-lg bg-accent px-4",
                    "text-base font-bold text-accent-foreground",
                    "transition-colors duration-(--duration-fast) hover:bg-accent/90",
                  )}
                >
                  <Phone className="size-5" aria-hidden="true" />
                  {displayPhone(phone)}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("detail.noPhone")}</p>
        )}
      </section>

      <section className="panel flex flex-col gap-3 p-4">
        <h2 className="text-base font-bold text-foreground">{t("detail.location")}</h2>
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {[data.village_or_locality, data.lsg_name, data.taluk, data.district_code]
              .filter(Boolean)
              .join(", ")}
            {data.landmark ? ` · ${data.landmark}` : ""}
          </span>
        </p>
        <Button asChild variant="outline" size="md" className="self-start">
          <a
            href={googleMapsHref(data.latitude, data.longitude, `${data.name} ${data.taluk ?? ""}`)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Navigation className="size-4" aria-hidden="true" />
            {t("action.directions")}
          </a>
        </Button>

        {data.latitude !== null && data.longitude !== null ? (
          <CampMap
            className="h-64"
            points={[
              {
                id: data.id,
                name: data.name,
                lat: data.latitude,
                lng: data.longitude,
                tone: isPreDesignated(data)
                  ? "predesignated"
                  : data.status === "active"
                    ? "active"
                    : "inactive",
              },
            ]}
          />
        ) : null}
      </section>

      <CampPhotos campId={data.id} />

      <section className="panel flex flex-col gap-3 p-4">
        <h2 className="text-base font-bold text-foreground">{t("detail.inside")}</h2>
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          <Stat
            icon={<Users className="size-4" aria-hidden="true" />}
            label={t("detail.occupancy")}
            value={data.reported_people_count}
          />
          <Stat
            icon={<ScrollText className="size-4" aria-hidden="true" />}
            label={tp("detail.reportedBy", data.report_count)}
            value={data.report_count}
          />
        </dl>

        {data.amenities.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {data.amenities.map((key) => {
              const Icon = amenityIcon(key);
              if (!Icon) return null;
              return (
                <li
                  key={key}
                  className="inline-flex items-center gap-1.5 rounded-full bg-verified-soft px-2.5 py-1 text-xs font-semibold text-verified"
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {t(`amenity.${key}` as DictKey)}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("detail.amenitiesNone")}</p>
        )}
      </section>

      <section className="panel flex flex-col gap-3 p-4">
        <h2 className="text-base font-bold text-foreground">{t("need.title")}</h2>
        {needs.isPending ? null : (needs.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">{t("need.none")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {(needs.data ?? []).map((need) => {
              const Icon = needIcon(need.item_key);
              const progress =
                need.needed_qty > 0
                  ? Math.min(100, Math.round((need.pledged_qty / need.needed_qty) * 100))
                  : 0;
              return (
                <li key={need.id} className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">
                      {t(`need.${need.item_key}` as DictKey)}
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setDonating(need.id)}
                  >
                    {t("action.donate")}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <CheckInCard campId={data.id} count={data.checkin_count} />

      <section className="panel flex flex-col gap-3 p-4">
        <h2 className="text-base font-bold text-foreground">{t("help.title")}</h2>
        <EmergencyContacts districtCode={data.district_code} />
      </section>

      {(needs.data ?? [])
        .filter((need) => need.id === donating)
        .map((need) => (
          <DonateDialog
            key={need.id}
            need={need}
            open
            onOpenChange={(next) => !next && setDonating(null)}
          />
        ))}

      <Link
        to={`/report?campId=${data.id}`}
        className="self-start rounded-sm text-sm font-semibold text-accent underline-offset-2 hover:underline"
      >
        {t("detail.correction")}
      </Link>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
}) {
  if (value === null || value === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-base font-bold text-foreground">{value.toLocaleString("en-IN")}</dd>
      </div>
    </div>
  );
}
