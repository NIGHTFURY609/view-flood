import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { useI18n } from "@/shared/i18n";

/**
 * One pagination pattern for every list. The prototype used prev/next on the
 * camps list and an accumulating "load more" on requirements.
 */
export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (nextPage: number) => void;
}) {
  const { t } = useI18n();
  if (pageCount <= 1) return null;

  return (
    <nav aria-label={t("page.label")} className="flex items-center justify-between gap-3 pt-2">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t("page.prev")}
      </Button>

      <span aria-live="polite" className="text-xs font-medium text-muted-foreground">
        {t("page.of", { page, pages: pageCount })}
      </span>

      <Button
        variant="outline"
        size="sm"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
      >
        {t("page.next")}
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}
