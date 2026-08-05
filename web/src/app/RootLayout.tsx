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
import { NavLink, Outlet, Link, useLocation } from "react-router";

import { InfoTip } from "@/shared/components/InfoTip";
import { Button } from "@/shared/components/ui/button";
import { LanguagePill } from "@/shared/components/LanguagePill";
import { ThemeToggle } from "@/shared/components/ThemeToggle";
import { useFooterLift } from "@/shared/hooks/useFooterLift";
import { useOnline } from "@/shared/hooks/useGeolocation";
import { useI18n, type DictKey } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import {
  DRAG_THRESHOLD,
  FAB_MARGIN,
  computeSnapLeft,
  dragToPosition,
  type FabPosition,
} from "@/shared/lib/fabDrag";

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

interface SurveyButtonProps {
  /** Px to raise the button above the footer while it is on screen. */
  readonly lift: number;
  /** Changes on navigation; used to reset any dragged position. */
  readonly resetKey: string;
}

function SurveyButton({ lift, resetKey }: SurveyButtonProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLAnchorElement>(null);
  const [dragged, setDragged] = useState<FabPosition | null>(null);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ pointerId: number; x: number; y: number; origin: FabPosition } | null>(null);
  const movedRef = useRef(false);

  // Dragged position is temporary: it resets when the footer-lift engages
  // (button returns to its docked slot, lifted) and on every navigation.
  useEffect(() => {
    setDragged(null);
    setDragging(false);
    startRef.current = null;
    movedRef.current = false;
  }, [resetKey, lift > 0]);

  const onPointerDown = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    startRef.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      origin: { left: rect.left, top: rect.top },
    };
    movedRef.current = false;
    setDragging(true);
    el.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const start = startRef.current;
    const el = ref.current;
    if (!start || !el || e.pointerId !== start.pointerId) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > DRAG_THRESHOLD) {
      movedRef.current = true;
    }
    setDragged(
      dragToPosition(
        start.origin,
        { x: start.x, y: start.y },
        { x: e.clientX, y: e.clientY },
        { width: window.innerWidth, height: window.innerHeight },
        { width: el.offsetWidth, height: el.offsetHeight },
        FAB_MARGIN,
      ),
    );
  };

  const endDrag = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const start = startRef.current;
    const el = ref.current;
    if (!start || !el || e.pointerId !== start.pointerId) return;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    startRef.current = null;
    setDragging(false);
    if (movedRef.current) {
      // Snap to the nearest horizontal edge at the release height.
      setDragged((prev) => {
        const width = el.offsetWidth;
        const centerX = (prev?.left ?? start.origin.left) + width / 2;
        return {
          left: computeSnapLeft(centerX, window.innerWidth, width, FAB_MARGIN),
          top: prev?.top ?? start.origin.top,
        };
      });
    }
  };

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (movedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      movedRef.current = false;
    }
  };

  return (
    <a
      ref={ref}
      href={SURVEY_URL}
      target="_blank"
      rel="noopener noreferrer"
      draggable={false}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClick={onClick}
      aria-label={t("survey.button")}
      className={cn(
        "fixed z-(--z-header) touch-none select-none",
        "flex items-center justify-center gap-2 rounded-full px-4 py-2.5 shadow-overlay",
        "bg-accent text-accent-foreground text-sm font-semibold",
        "transition-colors duration-(--duration-fast) hover:bg-accent/90",
        dragging ? "cursor-grabbing" : "cursor-grab",
        dragged
          ? "left-auto top-auto"
          : "right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom)+var(--fab-lift,0px))] lg:bottom-[calc(1.5rem+var(--fab-lift,0px))]",
      )}
      style={dragged ? { left: dragged.left, top: dragged.top } : undefined}
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
      className="fixed bottom-[calc(7.5rem+env(safe-area-inset-bottom)+var(--fab-lift,0px))] right-4 z-(--z-header) rounded-full shadow-overlay lg:bottom-[calc(4.5rem+var(--fab-lift,0px))]"
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
  const { pathname } = useLocation();
  const headerRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const mobileNavRef = useRef<HTMLElement>(null);
  const footerLift = useFooterLift(footerRef, mobileNavRef);
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

  // Floating actions ride the footer's top edge while it is on screen, so the
  // footer text (data-source note, helplines/emergency links) stays readable.
  useEffect(() => {
    document.documentElement.style.setProperty("--fab-lift", `${footerLift}px`);
    return () => {
      document.documentElement.style.removeProperty("--fab-lift");
    };
  }, [footerLift]);

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

      <footer ref={footerRef} className="border-t border-border bg-surface">
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
        ref={mobileNavRef}
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

      <SurveyButton lift={footerLift} resetKey={pathname} />
      <BackToTop />
    </div>
  );
}
