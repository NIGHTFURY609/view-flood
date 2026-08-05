/**
 * Motion layer — anime.js v4.
 *
 * Every helper here is a no-op (or jumps to the final state) when the user
 * prefers reduced motion. We gate on `matchMedia('(prefers-reduced-motion:
 * reduce)')` rather than scattering checks at call sites, so callers can animate
 * freely and stay accessible by construction.
 *
 * Where anime.js runs (and nowhere else): card-list entrance, wizard step
 * transitions, status-badge change, the language-pill slide, the theme-toggle
 * icon morph, and dropdown open/close. Parallax, auto-looping decor, and any
 * animation in front of the emergency call are forbidden.
 */
import { animate, createTimeline, stagger, utils } from "animejs";

const reducedMotionQuery =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

export function prefersReduced(): boolean {
  return reducedMotionQuery?.matches ?? false;
}

/** Staggered fade+rise for the camp list. Capped at the first 12 visible cards. */
export function revealCards(selector = ".camp-card", scope?: ParentNode): void {
  if (prefersReduced()) return;
  const root = scope ?? document;
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(selector)).slice(0, 12);
  if (nodes.length === 0) return;
  animate(nodes, {
    opacity: [0, 1],
    translateY: [12, 0],
    duration: 280,
    delay: stagger(40, { from: "first" }),
    ease: "outQuad",
  });
}

/**
 * Wizard step transition: outgoing step slides/fades out, incoming slides/fades
 * in. Interruption-safe — calling it again retargets the same elements instead
 * of queueing a second timeline.
 */
export function wizardTransition(
  oldEl: HTMLElement | null,
  newEl: HTMLElement | null,
): void {
  if (prefersReduced()) {
    if (oldEl) utils.set(oldEl, { opacity: 0, display: "none", transform: "none" });
    if (newEl) utils.set(newEl, { opacity: 1, display: "block", transform: "none" });
    return;
  }
  const tl = createTimeline({ defaults: { ease: "outExpo", duration: 320 } });
  if (oldEl) tl.add(oldEl, { opacity: [1, 0], translateX: [0, -16] }, 0);
  if (newEl) tl.add(newEl, { opacity: [0, 1], translateX: [16, 0] }, "-=160");
}

/** Subtle scale pulse when a status value changes on a data refresh. */
export function pulseBadge(el: HTMLElement | null): void {
  if (!el || prefersReduced()) return;
  animate(el, { scale: [1, 1.12, 1], duration: 200, ease: "outQuad" });
}

/** Slide the active segment of the language pill between EN and ML. */
export function slideLanguagePill(el: HTMLElement, toX: number): void {
  if (prefersReduced()) {
    utils.set(el, { translateX: toX });
    return;
  }
  animate(el, { translateX: toX, duration: 180, ease: "outQuad" });
}

/** Crossfade two icon nodes (sun <-> moon). */
export function morphThemeIcon(from: Element, to: Element): void {
  if (prefersReduced()) {
    utils.set(from, { opacity: 0 });
    utils.set(to, { opacity: 1 });
    return;
  }
  animate(from, { opacity: [1, 0], duration: 140, ease: "outQuad" });
  animate(to, { opacity: [0, 1], duration: 140, ease: "outQuad" });
}

/** Gentle one-shot scale-in (empty states). Never loops. */
export function scaleIn(el: HTMLElement | null): void {
  if (!el || prefersReduced()) return;
  animate(el, { opacity: [0, 1], scale: [0.92, 1], duration: 200, ease: "outQuad" });
}

/** Expand a height:0 container to its content (dropdown / filter sheet body). */
export function expand(el: HTMLElement): void {
  if (prefersReduced()) {
    utils.set(el, { height: "auto", opacity: 1 });
    return;
  }
  const full = el.scrollHeight;
  animate(el, {
    height: [0, full],
    opacity: [0, 1],
    duration: 180,
    ease: "outQuad",
    onComplete: () => utils.set(el, { height: "auto" }),
  });
}

/** Collapse a container back to height:0. */
export function collapse(el: HTMLElement, done?: () => void): void {
  if (prefersReduced()) {
    utils.set(el, { height: 0, opacity: 0 });
    done?.();
    return;
  }
  const full = el.scrollHeight;
  utils.set(el, { height: full });
  animate(el, {
    height: [full, 0],
    opacity: [1, 0],
    duration: 180,
    ease: "outQuad",
    onComplete: () => {
      utils.set(el, { height: 0, opacity: 0 });
      done?.();
    },
  });
}
