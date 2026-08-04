import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

import { useI18n } from "@/shared/i18n";

export interface Crumb {
  readonly label: string;
  /** Omit for non-navigable segments such as a taluk name. */
  readonly to?: string;
}

export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  const { t } = useI18n();

  return (
    <nav aria-label={t("a11y.breadcrumb")}>
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? (
                <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden="true" />
              ) : null}
              {isLast || !item.to ? (
                <span
                  className="max-w-[14rem] truncate"
                  {...(isLast ? { "aria-current": "page" as const } : {})}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.to}
                  className="max-w-[14rem] truncate rounded-sm underline-offset-2 hover:text-foreground hover:underline"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
