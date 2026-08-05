import { useEffect, useState, type RefObject } from "react";

/** Gap between the raised floating actions and the footer's top edge. */
export const FOOTER_LIFT_GAP = 8;

/**
 * Extra gap between the survey FAB and the docked bottom tab bar. On mobile the
 * survey FAB docks 4.5rem above the viewport bottom while the tab bar is only
 * ~3.5rem tall + safe inset, so the FAB's resting offset is (tab bar + this).
 * On desktop there is no tab bar; the FAB docks 1.5rem (24px) from the bottom.
 */
export const FAB_ABOVE_TABBAR = 16;
export const FAB_DOCK_DESKTOP = 24;

/**
 * How far the floating action buttons must rise (in px) so they sit just above
 * the footer's top edge while the footer is on screen. 0 when the footer is
 * fully below the fold.
 *
 * The lift is measured against the FAB's *docked* baseline (bottom tab bar on
 * mobile, 1.5rem on desktop), not the viewport bottom — otherwise the buttons
 * would over-lift by the tab bar height and float over in-page controls.
 * Recomputed on scroll, resize, and footer size changes, throttled to frames.
 */
export function useFooterLift(
  footerRef: RefObject<HTMLElement | null>,
  navRef: RefObject<HTMLElement | null>,
): number {
  const [lift, setLift] = useState(0);

  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const nav = navRef.current;
      const navH = nav ? nav.offsetHeight : 0;
      const dockBase = navH > 0 ? navH + FAB_ABOVE_TABBAR : FAB_DOCK_DESKTOP;
      const top = el.getBoundingClientRect().top;
      const vh = window.innerHeight;
      const next = top < vh ? Math.max(0, vh - top + FOOTER_LIFT_GAP - dockBase) : 0;
      setLift((prev) => (prev === next ? prev : next));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(schedule);
      ro.observe(el);
      return () => {
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
        ro.disconnect();
        if (raf) cancelAnimationFrame(raf);
      };
    }

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [footerRef, navRef]);

  return lift;
}
