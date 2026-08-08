import { ChevronRight, Navigation, Phone } from "lucide-react";
import { Link } from "react-router";

import {
  isPreDesignated,
  PreDesignatedBadge,
  StalenessNote,
  StatusBadge,
  UrgencyBadge,
  VerificationBadge,
} from "@/shared/components/badges";
import { NeedChips } from "@/shared/components/NeedChips";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { displayPhone, formatDistanceKm, formatIst } from "@/shared/lib/format";
import { googleMapsHref } from "@/shared/lib/maps";
import type { CampListItem } from "@/shared/types/api";

export function CampCard({ camp }: { camp: CampListItem }) {
  const { t } = useI18n();

  const path = [camp.district_code, camp.taluk, camp.lsg_name].filter(Boolean).join(" › ");
  const preDesignated = isPreDesignated(camp);

  return (
    <article className="panel flex flex-col overflow-hidden">
      {/* One link covers the identity block; the action bar sits outside it so
          call/directions are not nested interactive elements. */}
      <Link
        to={`/camps/${camp.id}`}
        className="group flex flex-1 flex-col gap-2.5 p-4 transition-colors duration-(--duration-fast) hover:bg-secondary/50"
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold leading-snug text-foreground text-pretty">
              {camp.name}
            </h2>
            {camp.name_ml ? (
              <p lang="ml" className="truncate text-sm text-muted-foreground">
                {camp.name_ml}
              </p>
            ) : null}
          </div>
          <ChevronRight
            className="mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform duration-(--duration-fast) group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </div>

        <p className="truncate text-xs text-muted-foreground">{path}</p>

        <div className="flex flex-wrap items-center gap-1.5">
          <VerificationBadge state={camp.verification_state} />
          {preDesignated ? <PreDesignatedBadge /> : <StatusBadge status={camp.status} />}
          <UrgencyBadge
            urgency={camp.urgency}
            reportedOnly={camp.urgency === "normal" && camp.reported_urgency !== null}
          />
          {camp.distance_km !== null ? (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
              {t("location.away", { km: formatDistanceKm(camp.distance_km) })}
            </span>
          ) : null}
        </div>

        {camp.top_needs.length > 0 ? <NeedChips needs={camp.top_needs} /> : null}

        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
          <span className="text-xs text-muted-foreground">
            {camp.status_last_confirmed_at
              ? t("detail.reportedAt", { time: formatIst(camp.status_last_confirmed_at) })
              : t("detail.neverConfirmed")}
          </span>
          <StalenessNote lastConfirmedAt={camp.status_last_confirmed_at} />
        </div>
      </Link>

      <div className="flex items-stretch gap-px border-t border-border bg-border">
        {camp.camp_phone_primary ? (
          <a
            href={`tel:${camp.camp_phone_primary}`}
            className={cn(
              "flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 bg-surface px-3",
              "text-sm font-semibold text-foreground",
              "transition-colors duration-(--duration-fast) hover:bg-secondary",
            )}
          >
            <Phone className="size-4 text-accent" aria-hidden="true" />
            {displayPhone(camp.camp_phone_primary)}
          </a>
        ) : (
          <span className="flex min-h-11 min-w-0 flex-1 items-center justify-center bg-surface px-3 text-xs text-muted-foreground">
            {t("detail.noPhone")}
          </span>
        )}

        <a
          href={googleMapsHref(camp.latitude, camp.longitude, `${camp.name} ${camp.taluk ?? ""}`)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("action.directions")}
          className={cn(
            "flex min-h-11 w-14 shrink-0 items-center justify-center bg-surface",
            "text-accent transition-colors duration-(--duration-fast) hover:bg-secondary",
          )}
        >
          <Navigation className="size-4" aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}
