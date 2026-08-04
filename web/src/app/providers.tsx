import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useEffect, type ReactNode } from "react";
import { Toaster, toast } from "sonner";
import { useRegisterSW } from "virtual:pwa-register/react";

import { persistOptions } from "@/shared/api/persist";
import { queryClient } from "@/shared/api/queryClient";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { I18nProvider, useI18n } from "@/shared/i18n";
import { ThemeProvider } from "@/shared/lib/theme";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <ThemeProvider>
        <I18nProvider>
          <TooltipProvider>
            {children}
            <UpdatePrompt />
            <Toaster
              position="top-center"
              closeButton
              toastOptions={{
                classNames: {
                  toast: "!bg-surface !text-foreground !border-border !shadow-overlay",
                  description: "!text-muted-foreground",
                },
              }}
            />
          </TooltipProvider>
        </I18nProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}

/**
 * Offers a reload when a new build is available. Never reloads on its own — a
 * silent refresh would discard a half-finished report.
 */
function UpdatePrompt() {
  const { t } = useI18n();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

  useEffect(() => {
    if (!needRefresh) return;

    toast(t("app.name"), {
      description: t("action.refresh"),
      duration: Infinity,
      action: {
        label: t("action.refresh"),
        onClick: () => {
          setNeedRefresh(false);
          void updateServiceWorker(true);
        },
      },
      onDismiss: () => setNeedRefresh(false),
    });
  }, [needRefresh, setNeedRefresh, updateServiceWorker, t]);

  return null;
}
