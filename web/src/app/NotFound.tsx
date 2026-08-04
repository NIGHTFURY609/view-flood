import { MapPinned, SearchX } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router";

import { EmptyState } from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import { useI18n } from "@/shared/i18n";

export function NotFound() {
  const { t } = useI18n();

  useEffect(() => {
    document.title = `${t("notFound.title")} — ${t("app.name")}`;
  }, [t]);

  return (
    <EmptyState
      icon={<SearchX className="size-6" aria-hidden="true" />}
      title={t("notFound.title")}
      hint={t("notFound.body")}
      action={
        <Button asChild variant="primary" size="md">
          <Link to="/">
            <MapPinned className="size-4" aria-hidden="true" />
            {t("action.goHome")}
          </Link>
        </Button>
      }
    />
  );
}
