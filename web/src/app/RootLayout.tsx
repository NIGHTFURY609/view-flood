import {
  ArrowUp,
  LifeBuoy,
  Moon,
  MapPinned,
  PackageSearch,
  Phone,
  Plus,
  Sun,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, Outlet, Link } from "react-router";

import { InfoTip } from "@/shared/components/InfoTip";
import { Button } from "@/shared/components/ui/button";
import { useOnline } from "@/shared/hooks/useGeolocation";
import { useI18n, type DictKey } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { useTheme } from "@/shared/lib/theme";

interface NavItem {
  readonly to: string;
  readonly labelKey: DictKey;
  readonly icon: typeof MapPinned;
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: "/", labelKey: "nav.camps", icon: MapPinned },
  { to: "/needs", labelKey: "nav.needs", icon: PackageSearch },
  { to: "/report", labelKey: "nav.report", icon: Plus },
  { to: "/helplines", labelKey: "nav.help", icon: LifeBuoy },
];

const EMERGENCY_NUMBER = "1077";

function Wordmark() {
  const { t } = useI18n();
  // No aria-label here: the visible name plus tagline already form a good
  // accessible name, and an aria-label that omitted the tagline broke the
  // WCAG 2.5.3 "label in name" rule.
  return (
    <Link to="/" className="flex min-w-0 items-center gap-2 rounded-lg py-1 pr-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
        <LifeBuoy className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold leading-tight text-foreground">
          {t("app.name")}
        </span>
        <span className="hidden truncate text-xs leading-tight text-muted-foreground sm:block">
          {t("app.tagline")}
        </span>
      </span>
    </Link>
  );
}

function Toggles() {
  const { t, locale, toggle: toggleLocale } = useI18n();
  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <div className="flex items-center gap-1">
      {/* The accessible name must CONTAIN the visible text (WCAG 2.5.3), so the
          visible label leads and the explanation follows via title. */}
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleLocale}
        title={t("lang.toggle")}
        className="px-2 text-xs font-semibold"
      >
        {locale === "en" ? "മലയാളം" : "English"}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        aria-label={t("theme.toggle")}
        aria-pressed={theme === "dark"}
      >
        {theme === "dark" ? (
          <Sun className="size-5" aria-hidden="true" />
        ) : (
          <Moon className="size-5" aria-hidden="true" />
        )}
      </Button>
    </div>
  );
}

function EmergencyButton({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <a
      href={`tel:${EMERGENCY_NUMBER}`}
      aria-label={t("tip.emergency")}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-lg bg-critical px-3",
        "text-sm font-bold text-critical-foreground",
        "transition-colors duration-(--duration-fast) hover:bg-critical/90",
        className,
      )}
    >
      <Phone className="size-4" aria-hidden="true" />
      {EMERGENCY_NUMBER}
    </a>
  );
}

function BackToTop() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={t("action.backToTop")}
      className="fixed bottom-20 right-4 z-(--z-header) rounded-full shadow-overlay lg:bottom-6"
    >
      <ArrowUp className="size-5" aria-hidden="true" />
    </Button>
  );
}

export function RootLayout() {
  const { t } = useI18n();
  const online = useOnline();
  const headerRef = useRef<HTMLElement>(null);

  /**
   * Publish the real header height as --header-h so sticky bars can sit exactly
   * below it. The prototype hardcoded `top-[5.4rem] lg:top-[3.6rem]` in five
   * route files, which broke whenever header content changed.
   */
  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const publish = () => {
      document.documentElement.style.setProperty(
        "--header-h",
        `${Math.round(header.getBoundingClientRect().height)}px`,
      );
    };

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  const navClass = useCallback(
    ({ isActive }: { isActive: boolean }) =>
      cn(
        "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold",
        "transition-colors duration-(--duration-fast)",
        isActive
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      ),
    [],
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className={cn(
          "sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4",
          "focus-visible:z-(--z-toast) focus-visible:rounded-lg focus-visible:bg-accent",
          "focus-visible:px-4 focus-visible:py-3 focus-visible:text-sm focus-visible:font-semibold",
          "focus-visible:text-accent-foreground",
        )}
      >
        {t("a11y.skipToContent")}
      </a>

      {/* One header, responsive. The prototype maintained two parallel copies. */}
      <header
        ref={headerRef}
        className="sticky top-0 z-(--z-header) border-b border-border bg-surface/95 backdrop-blur"
      >
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-3 py-2 sm:px-4">
          <Wordmark />
          <nav aria-label={t("a11y.primaryNav")} className="ml-auto hidden lg:block">
            <ul className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.to === "/"} className={navClass}>
                    <item.icon className="size-4" aria-hidden="true" />
                    {t(item.labelKey)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-1 lg:ml-2">
            <Toggles />
            <EmergencyButton />
          </div>
        </div>
      </header>

      {!online ? (
        <div
          role="status"
          className="flex items-center justify-center gap-2 bg-unverified-soft px-4 py-2 text-xs font-semibold text-unverified"
        >
          <WifiOff className="size-4" aria-hidden="true" />
          {t("offline.title")}
        </div>
      ) : null}

      {/* GUARD: never dismissible. PRD §7 — never claim official status. */}
      <div className="border-b border-border bg-secondary">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-1 px-3 sm:px-4">
          <p className="text-xs font-medium text-secondary-foreground">
            {t("disclaimer.title")}
          </p>
          <InfoTip label={t("disclaimer.body")} />
        </div>
      </div>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-3 pb-24 pt-4 sm:px-4 lg:pb-10">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-3 py-6 sm:px-4">
          <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
            {t("footer.dataSource")}
          </p>
          <div className="-my-2 flex flex-wrap items-center gap-x-4">
            <Link
              to="/helplines"
              className="inline-flex min-h-11 items-center rounded-sm text-xs font-semibold text-accent underline-offset-2 hover:underline"
            >
              {t("help.title")}
            </Link>
            <a
              href={`tel:${EMERGENCY_NUMBER}`}
              className="inline-flex min-h-11 items-center rounded-sm text-xs font-semibold text-critical underline-offset-2 hover:underline"
            >
              {t("footer.emergency")}
            </a>
          </div>
        </div>
      </footer>

      {/* Bottom tab bar is a genuinely mobile-only affordance, not duplicated
          chrome. It gets its own landmark label so screen-reader users are not
          offered two identically-named navigations. */}
      <nav
        aria-label={t("a11y.mobileNav")}
        className="fixed inset-x-0 bottom-0 z-(--z-header) grid grid-cols-4 border-t border-border bg-surface/95 backdrop-blur lg:hidden"
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1",
                "text-xs font-semibold transition-colors duration-(--duration-fast)",
                isActive ? "text-accent" : "text-muted-foreground",
              )
            }
          >
            <item.icon className="size-5" aria-hidden="true" />
            <span className="truncate">{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      <BackToTop />
    </div>
  );
}
