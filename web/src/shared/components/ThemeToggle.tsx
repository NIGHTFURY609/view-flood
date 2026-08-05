import { Moon, Sun } from "lucide-react";
import { useRef } from "react";

import { useI18n } from "@/shared/i18n";
import { morphThemeIcon } from "@/shared/lib/motion";
import { useTheme } from "@/shared/lib/theme";
import { cn } from "@/shared/lib/cn";

/**
 * Sun/moon toggle. The icon morph is an anime.js crossfade; the token colours
 * themselves morph via a brief `.theme-transition` class on <html> (removed on
 * transitionend) so the whole page eases between themes without animating every
 * element individually.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();
  const sunRef = useRef<SVGSVGElement>(null);
  const moonRef = useRef<SVGSVGElement>(null);

  const handle = () => {
    const root = document.documentElement;
    root.classList.add("theme-transition");
    const cleanup = () => {
      root.classList.remove("theme-transition");
      root.removeEventListener("transitionend", cleanup);
    };
    root.addEventListener("transitionend", cleanup, { once: true });
    window.setTimeout(cleanup, 360);

    toggle();

    if (sunRef.current && moonRef.current) {
      morphThemeIcon(
        theme === "dark" ? sunRef.current : moonRef.current,
        theme === "dark" ? moonRef.current : sunRef.current,
      );
    }
  };

  return (
    <button
      type="button"
      onClick={handle}
      aria-label={t("theme.toggle")}
      aria-pressed={theme === "dark"}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-lg text-foreground",
        "hover:bg-secondary transition-colors duration-(--duration-fast)",
        className,
      )}
    >
      <span className="relative grid size-5 place-items-center">
        <Sun
          ref={sunRef}
          className={cn("absolute size-5", theme === "dark" ? "opacity-0" : "opacity-100")}
          aria-hidden="true"
        />
        <Moon
          ref={moonRef}
          className={cn("absolute size-5", theme === "dark" ? "opacity-100" : "opacity-0")}
          aria-hidden="true"
        />
      </span>
    </button>
  );
}
