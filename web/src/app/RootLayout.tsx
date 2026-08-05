import {
  ArrowUp,
  ClipboardList,
  LifeBuoy,
  MapPinned,
  PackageSearch,
  Phone,
  Plus,
  WifiOff,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, Outlet, Link } from "react-router";

import { InfoTip } from "@/shared/components/InfoTip";
import { Button } from "@/shared/components/ui/button";
import { LanguagePill } from "@/shared/components/LanguagePill";
import { ThemeToggle } from "@/shared/components/ThemeToggle";
import { useOnline } from "@/shared/hooks/useGeolocation";
import { useI18n, type DictKey } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";

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
const DISCLAIMER_KEY = "kcc.disclaimer.dismissed";

function Wordmark() {
  const { t } = useI18n();
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

function EmergencyButton({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <a
      href={`tel:${EMERGENCY_NUMBER}`}
      aria-label={t("tip.emergency")}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-lg bg-danger-call px-3",
        "text-sm font-bold text-danger-call-foreground",
        "transition-colors duration-(--duration-fast) hover:bg-danger-call/90",
        className,
      )}
    >
      <Phone className="size-4" aria-hidden="true" />
      {EMERGENCY_NUMBER}
    </a>
  );
}

const SURVEY_URL = "https://forms.gle/tNRqJGTFSTFSkMGMA";

function SurveyButton() {
  const { t } = useI18n();
  return (
    <a
      href={SURVEY_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("survey.button")}
      className={cn(
        "fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-(--z-header) lg:bottom-6",
        "flex items-center justify-center gap-2 rounded-full px-4 py-2.5 shadow-overlay",
        "bg-accent text-accent-foreground text-sm font-semibold",
        "transition-colors duration-(--duration-fast) hover:bg-accent/90",
      )}
    >
      <ClipboardList className="size-4 shrink-0" aria-hidden="true" />
      <span className="whitespace-nowrap">{t("survey.button")}</span>
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
      className="fixed bottom-[calc(8.5rem+env(safe-area-inset-bottom))] right-4 z-(--z-header) rounded-full shadow-overlay lg:bottom-[4.5rem]"
    >
      <ArrowUp className="size-5" aria-hidden="true" />
    </Button>
  );
}

function DisclaimerBar() {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(
    () => typeof sessionStorage !== "undefined" && sessionStorage.getItem(DISCLAIMER_KEY) === "1",
  );

  if (dismissed) return null;

  return (
    <div className="border-b border-border bg-secondary">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-3 py-2 sm:px-4">
        <p className="text-xs font-medium text-secondary-foreground">{t("disclaimer.title")}</p>
        <InfoTip label={t("disclaimer.body")} />
        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.setItem(DISCLAIMER_KEY, "1");
            } catch {
              /* sessionStorage unavailable — bar just stays */
            }
            setDismissed(true);
          }}
          aria-label={t("action.dismiss")}
          className="relative ml-auto inline-flex size-7 items-center justify-center rounded-md text-muted-foreground before:absolute before:-inset-2 before:rounded-md before:content-[''] hover:bg-surface hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function RootLayout() {
  const { t } = useI18n();
  const online = useOnline();
  const headerRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navClass = (isActive: boolean) =>
    cn(
      "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold",
      "transition-colors duration-(--duration-fast)",
      isActive
        ? "bg-secondary text-foreground"
        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
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

      <header
        ref={headerRef}
        className={cn(
          "sticky top-0 z-(--z-header) border-b border-border bg-surface/95 backdrop-blur",
          "transition-shadow duration-(--duration-fast)",
          scrolled && "shadow-sm",
        )}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-3 py-2 sm:px-4">
          <Wordmark />
          <nav aria-label={t("a11y.primaryNav")} className="ml-auto hidden lg:block">
            <ul className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) => navClass(isActive)}
                  >
                    <item.icon className="size-4" aria-hidden="true" />
                    {t(item.labelKey)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2 lg:ml-2">
            <LanguagePill />
            <ThemeToggle />
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

      <DisclaimerBar />

      <main
        id="main"
        className="mx-auto w-full max-w-6xl flex-1 px-3 pb-28 pt-4 sm:px-4 lg:pb-10"
      >
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
              className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-xs font-bold text-danger-call underline-offset-2 hover:underline"
            >
              <Phone className="size-3.5" aria-hidden="true" />
              {t("footer.emergency")}
            </a>
          </div>
        </div>
      </footer>

      {/* Bottom tab bar: thumb-reachable primary nav. Gets its own landmark label
          and respects the safe-area inset on modern phones. */}
      <nav
        aria-label={t("a11y.mobileNav")}
        className="fixed inset-x-0 bottom-0 z-(--z-header) grid grid-cols-4 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
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
            <span className="text-center leading-tight">{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      <SurveyButton />
      <BackToTop />
    </div>
  );
}
