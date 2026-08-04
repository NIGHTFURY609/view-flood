import { Navigation, Phone, UserCheck } from "lucide-react";
import { Link } from "react-router";

import {
  isPreDesignated,
  PreDesignatedBadge,
  StatusBadge,
  UrgencyBadge,
  VerificationBadge,
} from "@/shared/components/badges";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { googleMapsHref } from "@/shared/lib/maps";
import { formatDistanceKm } from "@/shared/lib/format";
import type { CampListItem } from "@/shared/types/api";


/** Dense single-line variant for the list view. */
export function CampRow({ camp }: { camp: CampListItem }) {
  const { t } = useI18n();
  const path = [camp.district_code, camp.taluk, camp.lsg_name].filter(Boolean).join(" › ");

  return (
    <article className="panel flex items-stretch overflow-hidden">
      <Link
        to={`/camps/${camp.id}`}
        className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-3 transition-colors duration-(--duration-fast) hover:bg-secondary/50"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="truncate text-sm font-bold text-foreground">{camp.name}</h2>
          <VerificationBadge state={camp.verification_state} />
          {isPreDesignated(camp) ? <PreDesignatedBadge /> : <StatusBadge status={camp.status} />}
          <UrgencyBadge urgency={camp.urgency} />
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="truncate text-xs text-muted-foreground">{path}</span>
          {camp.distance_km !== null ? (
            <span className="text-xs font-semibold text-accent">
              {t("location.away", { km: formatDistanceKm(camp.distance_km) })}
            </span>
          ) : null}
          {camp.checkin_count > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <UserCheck className="size-3.5" aria-hidden="true" />
              {camp.checkin_count}
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex items-stretch gap-px border-l border-border bg-border">
        {camp.camp_phone_primary ? (
          <a
            href={`tel:${camp.camp_phone_primary}`}
            aria-label={`${t("action.call")} ${camp.name}`}
            className={cn(
              "flex w-12 items-center justify-center bg-surface text-accent",
              "transition-colors duration-(--duration-fast) hover:bg-secondary",
            )}
          >
            <Phone className="size-4" aria-hidden="true" />
          </a>
        ) : null}
        <a
          href={googleMapsHref(camp.latitude, camp.longitude, `${camp.name} ${camp.taluk ?? ""}`)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${t("action.directions")} — ${camp.name}`}
          className={cn(
            "flex w-12 items-center justify-center bg-surface text-accent",
            "transition-colors duration-(--duration-fast) hover:bg-secondary",
          )}
        >
          <Navigation className="size-4" aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}
