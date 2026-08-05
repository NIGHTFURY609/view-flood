export const FAB_MARGIN = 16;

/** Movement (px) beyond which a pointer gesture counts as a drag, not a tap. */
export const DRAG_THRESHOLD = 6;

export interface FabPosition {
  readonly left: number;
  readonly top: number;
}

export interface FabSize {
  readonly width: number;
  readonly height: number;
}

export interface FabViewport {
  readonly width: number;
  readonly height: number;
}

export interface PointerPoint {
  readonly x: number;
  readonly y: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Horizontal snap target: align the button's center to the nearer screen edge,
 * keeping `margin` from that edge. Falls back to the left edge when the button
 * is wider than the viewport can hold on the right.
 */
export function computeSnapLeft(
  centerX: number,
  viewportWidth: number,
  buttonWidth: number,
  margin: number,
): number {
  return centerX < viewportWidth / 2
    ? margin
    : Math.max(margin, viewportWidth - buttonWidth - margin);
}

/**
 * Position that follows the pointer from the drag origin, clamped inside the
 * viewport so the button never leaves the screen.
 */
export function dragToPosition(
  origin: FabPosition,
  startPointer: PointerPoint,
  pointer: PointerPoint,
  viewport: FabViewport,
  size: FabSize,
  margin: number,
): FabPosition {
  return {
    left: clamp(
      origin.left + (pointer.x - startPointer.x),
      margin,
      Math.max(margin, viewport.width - size.width - margin),
    ),
    top: clamp(
      origin.top + (pointer.y - startPointer.y),
      margin,
      Math.max(margin, viewport.height - size.height - margin),
    ),
  };
}
