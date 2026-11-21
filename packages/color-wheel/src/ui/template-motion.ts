// The motion of the wheel (docs/05 §6.2): when the harmony or the light
// changes, each mark travels to its new hue instead of jumping; when the base
// changes from outside the wheel (its color, the hex field or the model), the
// base travels to its new place and the template turns with it. Pure
// functions; the component runs the frames.

import type { WheelColor } from "../color/wheel-color.ts";

/** How long the wheel takes to reach its new place, in milliseconds. */
export const TEMPLATE_DURATION = 450;

/** Fast at first and gentle at the end. */
export function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * The hues of the marks at `t` (0 to 1) between two templates, the base
 * first. Each mark travels along the shortest arc. When the counts differ,
 * the extra marks come out of the base or go back into it, so the result has
 * as many marks as the longer template.
 */
export function interpolateTemplate(
  from: readonly number[],
  to: readonly number[],
  t: number,
): number[] {
  const count = Math.max(from.length, to.length);
  const fromBase = from[0] ?? 0;
  const toBase = to[0] ?? fromBase;
  return Array.from({ length: count }, (_, index) => {
    const start = from[index] ?? fromBase;
    const end = to[index] ?? toBase;
    const delta = ((((end - start) % 360) + 540) % 360) - 180;
    return (((start + delta * t) % 360) + 360) % 360;
  });
}

/** Whether two templates draw the same marks, to the hundredth of a degree. */
export function sameTemplate(
  a: readonly number[],
  b: readonly number[],
): boolean {
  return (
    a.length === b.length &&
    a.every((hue, index) => Math.abs(hue - (b[index] ?? NaN)) < 0.01)
  );
}

/** The shortest signed turn from `from` to `to`, in degrees, in [-180, 180). */
function shortestTurn(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/**
 * The base at `t` (0 to 1) on its way from `from` to `to`: the hue along the
 * shortest arc and the proportions in a straight line, so that they keep
 * adding up to 1.
 */
export function interpolatePosition(
  from: WheelColor,
  to: WheelColor,
  t: number,
): WheelColor {
  const hue =
    (((from.hue + shortestTurn(from.hue, to.hue) * t) % 360) + 360) % 360;
  // Weighted this way, both ends are exact.
  const mix = (a: number, b: number) => a * (1 - t) + b * t;
  return {
    hue,
    pure: mix(from.pure, to.pure),
    white: mix(from.white, to.white),
    black: mix(from.black, to.black),
  };
}

/**
 * The template at `t` while the base travels to `baseHue`: each mark keeps
 * its place relative to the base, so the template turns with the triangle,
 * and only moves within it if the harmony also changed. With the base still,
 * it is {@link interpolateTemplate}.
 */
export function turnTemplate(
  from: readonly number[],
  to: readonly number[],
  baseHue: number,
  t: number,
): number[] {
  const relative = (template: readonly number[]) => {
    const base = template[0] ?? 0;
    return template.map((hue) => (((hue - base) % 360) + 360) % 360);
  };
  return interpolateTemplate(relative(from), relative(to), t).map(
    (offset) => (((offset + baseHue) % 360) + 360) % 360,
  );
}
