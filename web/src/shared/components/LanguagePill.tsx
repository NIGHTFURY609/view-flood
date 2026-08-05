import { Languages } from "lucide-react";

import { useI18n, type Locale } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";

const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  ml: "മലയാളം",
};

/**
 * Single-button language switch. Shows the name of the language you can switch
 * TO (Malayalam UI shows "English", English UI shows "മലയാളം"), so the action
 * is obvious at a glance. Compact enough to stay in the header at every width —
 * the language name is always visible; the globe icon appears from sm up.
 */
export function LanguagePill({ className }: { className?: string }) {
  const { locale, toggle, t } = useI18n();
  const target: Locale = locale === "ml" ? "en" : "ml";
  const label = t("a11y.switchLanguage", { language: LANGUAGE_NAMES[target] });

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-pill",
        "border border-border-strong bg-surface-2 px-3 text-xs font-semibold text-foreground",
        "transition-colors duration-(--duration-fast) hover:bg-secondary",
        className,
      )}
    >
      <Languages className="hidden size-4 shrink-0 text-accent sm:block" aria-hidden="true" />
      <span className="whitespace-nowrap">{LANGUAGE_NAMES[target]}</span>
    </button>
  );
}
