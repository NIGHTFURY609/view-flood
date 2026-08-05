import { describe, expect, it } from "vitest";

import { clamp, computeSnapLeft, dragToPosition } from "./fabDrag";

describe("clamp", () => {
  it("keeps a value inside the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps below the minimum", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it("clamps above the maximum", () => {
    expect(clamp(42, 0, 10)).toBe(10);
  });
});

describe("computeSnapLeft", () => {
  it("snaps to the left edge when the center is in the left half", () => {
    expect(computeSnapLeft(100, 320, 120, 16)).toBe(16);
  });

  it("snaps to the right edge when the center is in the right half", () => {
    expect(computeSnapLeft(250, 320, 120, 16)).toBe(320 - 120 - 16);
  });

  it("keeps the button inside the viewport when it is very wide", () => {
    expect(computeSnapLeft(250, 320, 400, 16)).toBe(16);
  });
});

describe("dragToPosition", () => {
  it("follows the pointer delta from the drag origin", () => {
    const pos = dragToPosition(
      { left: 200, top: 300 },
      { x: 10, y: 10 },
      { x: 30, y: 60 },
      { width: 390, height: 844 },
      { width: 100, height: 44 },
      16,
    );
    expect(pos).toEqual({ left: 220, top: 350 });
  });

  it("clamps to the viewport edges", () => {
    const pos = dragToPosition(
      { left: 200, top: 300 },
      { x: 10, y: 10 },
      { x: 5000, y: -5000 },
      { width: 390, height: 844 },
      { width: 100, height: 44 },
      16,
    );
    expect(pos).toEqual({ left: 390 - 100 - 16, top: 16 });
  });
});
