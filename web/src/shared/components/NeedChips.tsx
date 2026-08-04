import { useI18n, type DictKey } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { needIcon } from "@/shared/lib/needs";
import type { CampNeedSummary } from "@/shared/types/api";

/** Compact list of what a camp is asking for. Critical items are tinted red. */
export function NeedChips({
  needs,
  limit = 5,
}: {
  needs: readonly CampNeedSummary[];
  limit?: number;
}) {
  const { t } = useI18n();
  if (needs.length === 0) return null;

  const shown = needs.slice(0, limit);
  const hidden = needs.length - shown.length;

  return (
    <ul aria-label={t("need.title")} className="flex flex-wrap items-center gap-1">
      {shown.map((need) => {
        const Icon = needIcon(need.item_key);
        const critical = need.urgency === "critical";
        return (
          <li key={need.item_key}>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
                critical
                  ? "bg-critical-soft text-critical"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {t(`need.${need.item_key}` as DictKey)}
            </span>
          </li>
        );
      })}
      {hidden > 0 ? (
        <li className="text-xs font-semibold text-muted-foreground">
          {t("need.more", { count: hidden })}
        </li>
      ) : null}
    </ul>
  );
}
