import { useLayoutEffect, useRef } from "react";

import { useI18n, type Locale } from "@/shared/i18n";
import { slideLanguagePill } from "@/shared/lib/motion";
import { cn } from "@/shared/lib/cn";

const SEGMENTS: readonly { locale: Locale; label: string }[] = [
  { locale: "en", label: "EN" },
  { locale: "ml", label: "മല" },
];

/**
 * Persistent header language toggle. The active segment's filled accent
 * background slides between EN and ML (anime.js) rather than hard-swapping, so
 * the control reads as a toggle. Always visible — never collapsed into a menu.
 */
export function LanguagePill({ className }: { className?: string }) {
  const { locale, setLocale } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const indicator = indicatorRef.current;
    if (!container || !indicator) return;
    const activeIndex = SEGMENTS.findIndex((s) => s.locale === locale);
    const step = container.offsetWidth / SEGMENTS.length;
    slideLanguagePill(indicator, activeIndex * step);
  }, [locale]);

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label="Language"
      className={cn(
        "relative inline-grid grid-cols-2 rounded-pill border border-border-strong bg-surface-2 p-0.5 text-xs font-semibold",
        className,
      )}
    >
      <span
        ref={indicatorRef}
        aria-hidden="true"
        className="absolute inset-y-0.5 left-0.5 w-[calc(50%-0.25rem)] rounded-pill bg-accent"
      />
      {SEGMENTS.map((s) => {
        const active = s.locale === locale;
        return (
          <button
            key={s.locale}
            type="button"
            onClick={() => setLocale(s.locale)}
            aria-pressed={active}
            className={cn(
              "relative z-10 min-h-9 rounded-pill px-3 py-1.5 transition-colors duration-(--duration-fast)",
              "before:absolute before:-inset-1 before:rounded-pill before:content-['']",
              active
                ? "text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
