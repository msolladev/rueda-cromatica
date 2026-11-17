// RYB model (docs/05 §3.2). The pure colors come from the corners of the cube
// by Gossett and Chen (2004), appendix A, as listed in the table of
// docs/05 §3.2. Between two corners, the pure color is interpolated linearly.

import { hsvHue, type Rgb } from "./rgb.ts";
import type { WheelColor } from "./wheel-color.ts";

/** The six color corners, in ring order, every 60°. */
const CORNERS: readonly Rgb[] = [
  { r: 1, g: 0, b: 0 }, // red, 0°
  { r: 1, g: 0.5, b: 0 }, // orange, 60°
  { r: 1, g: 1, b: 0 }, // yellow, 120°
  { r: 0, g: 0.66, b: 0.2 }, // green, 180°
  { r: 0.163, g: 0.373, b: 0.6 }, // blue, 240°
  { r: 0.5, g: 0, b: 0.5 }, // violet, 300°
];

const SEGMENT = 360 / CORNERS.length;

function corner(index: number): Rgb {
  const rgb = CORNERS[index % CORNERS.length];
  if (rgb === undefined) throw new Error(`No RYB corner ${String(index)}.`);
  return rgb;
}

function lerp(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

/** Pure color of the RYB hue `hue`, in [0, 360). */
export function rybPure(hue: number): Rgb {
  const segment = Math.floor(hue / SEGMENT);
  const t = (hue - segment * SEGMENT) / SEGMENT;
  return lerp(corner(segment), corner(segment + 1), t);
}

/**
 * HSV hue of the RYB pure color, unwrapped so that it grows from 0 to 360
 * around the whole ring: the last segment (violet → red) ends at 360, not 0.
 */
export function rybPureHsvHue(hue: number): number {
  const h = hsvHue(rybPure(hue)) ?? 0;
  return hue >= SEGMENT * (CORNERS.length - 1) && h < 180 ? h + 360 : h;
}

const ITERATIONS = 50;

/**
 * Inverts the mapping: the RYB hue whose pure color has the HSV hue `target`.
 * Since the mapping is increasing, it is enough to find the segment and halve
 * it down to floating-point precision.
 */
export function rybHueForHsvHue(target: number): number {
  for (let segment = 0; segment < CORNERS.length; segment += 1) {
    let low = segment * SEGMENT;
    let high = low + SEGMENT;
    if (target < rybPureHsvHue(low) || target > rybEndHue(high)) continue;
    for (let i = 0; i < ITERATIONS; i += 1) {
      const mid = (low + high) / 2;
      if (rybPureHsvHue(mid) < target) low = mid;
      else high = mid;
    }
    const hue = (low + high) / 2;
    return hue >= 360 ? 0 : hue;
  }
  throw new Error(`No RYB hue for HSV hue ${String(target)}.`);
}

/** HSV hue at the end of a segment; for the last one, 360. */
function rybEndHue(hue: number): number {
  return hue >= 360 ? 360 : rybPureHsvHue(hue);
}

/**
 * Proportions of the triangle point (pure, white and black) nearest to
 * `target`, by least squares in sRGB with non-negative weights. If `target`
 * lies outside the triangle, it is the nearest reachable point.
 */
export function nearestInTriangle(
  target: Rgb,
  pure: Rgb,
): Omit<WheelColor, "hue"> {
  // Black is the origin, so the point is pure · P + white · W.
  const candidates: [number, number][] = [];
  const pp = dot(pure, pure);
  const pw = pure.r + pure.g + pure.b;
  const ww = 3;
  const tp = dot(target, pure);
  const tw = target.r + target.g + target.b;

  const det = pp * ww - pw * pw;
  if (det > 0) {
    const p = (tp * ww - tw * pw) / det;
    const w = (pp * tw - pw * tp) / det;
    if (p >= 0 && w >= 0 && p + w <= 1) candidates.push([p, w]);
  }
  // The three sides: black-white, black-pure and white-pure.
  candidates.push([0, clamp01(tw / ww)]);
  candidates.push([clamp01(tp / pp), 0]);
  const fromWhite = { r: pure.r - 1, g: pure.g - 1, b: pure.b - 1 };
  const s = clamp01(
    dot({ r: target.r - 1, g: target.g - 1, b: target.b - 1 }, fromWhite) /
      dot(fromWhite, fromWhite),
  );
  candidates.push([s, 1 - s]);

  let best = { pure: 0, white: 0, black: 1 };
  let bestError = Infinity;
  for (const [p, w] of candidates) {
    const error = distance2(target, {
      r: p * pure.r + w,
      g: p * pure.g + w,
      b: p * pure.b + w,
    });
    if (error < bestError) {
      bestError = error;
      best = { pure: p, white: w, black: Math.max(0, 1 - p - w) };
    }
  }
  return best;
}

export function rybFromRgb(rgb: Rgb, previousHue: number): WheelColor {
  const target = hsvHue(rgb);
  const hue = target === undefined ? previousHue : rybHueForHsvHue(target);
  return { hue, ...nearestInTriangle(rgb, rybPure(hue)) };
}

function dot(a: Rgb, b: Rgb): number {
  return a.r * b.r + a.g * b.g + a.b * b.b;
}

function distance2(a: Rgb, b: Rgb): number {
  return (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
