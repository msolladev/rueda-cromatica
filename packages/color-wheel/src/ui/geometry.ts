// Geometry of the wheel in unit coordinates: the center is (0, 0), the outer
// edge of the ring has radius 1 and y grows downwards, as on screen. Hue 0° is
// at the top and grows clockwise.

import { normalizeHue } from "../color/rgb.ts";
import type { WheelColor } from "../color/wheel-color.ts";

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Inner radius of the ring. */
export const RING_INNER = 0.8;

/** Radius of the harmony marks: the middle of the ring. */
export const MARK_RADIUS = (RING_INNER + 1) / 2;

/** Radius of the triangle's vertices, inside the ring. */
export const TRIANGLE_RADIUS = 0.76;

/** Extra margin around the ring and the triangle to start a drag. */
const HIT_MARGIN = 0.04;

export function pointAt(hue: number, radius: number): Point {
  const angle = (hue * Math.PI) / 180;
  return { x: Math.sin(angle) * radius, y: -Math.cos(angle) * radius };
}

export function hueAt({ x, y }: Point): number {
  return normalizeHue((Math.atan2(x, -y) * 180) / Math.PI);
}

/** The vertices of the triangle for `hue`: pure, white and black. */
export function triangleVertices(hue: number): readonly [Point, Point, Point] {
  return [
    pointAt(hue, TRIANGLE_RADIUS),
    pointAt(hue + 120, TRIANGLE_RADIUS),
    pointAt(hue + 240, TRIANGLE_RADIUS),
  ];
}

/** Barycentric weights of `p` for the triangle: pure, white and black. */
export function barycentric(
  p: Point,
  [a, b, c]: readonly [Point, Point, Point],
): [number, number, number] {
  const d = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  const wa = ((b.y - c.y) * (p.x - c.x) + (c.x - b.x) * (p.y - c.y)) / d;
  const wb = ((c.y - a.y) * (p.x - c.x) + (a.x - c.x) * (p.y - c.y)) / d;
  return [wa, wb, 1 - wa - wb];
}

/** The point of the triangle with the proportions of `color`. */
export function trianglePoint(color: WheelColor): Point {
  const [p, w, k] = triangleVertices(color.hue);
  return {
    x: p.x * color.pure + w.x * color.white + k.x * color.black,
    y: p.y * color.pure + w.y * color.white + k.y * color.black,
  };
}

/**
 * The proportions of the triangle point nearest to `p`, for `hue`. Inside the
 * triangle it is `p` itself; outside, the nearest point of its edges.
 */
export function proportionsAt(p: Point, hue: number): Omit<WheelColor, "hue"> {
  const vertices = triangleVertices(hue);
  let weights = barycentric(p, vertices);
  if (weights.some((weight) => weight < 0)) {
    weights = barycentric(nearestOnEdges(p, vertices), vertices);
  }
  const [pure, white, black] = weights.map((weight) => Math.max(0, weight)) as [
    number,
    number,
    number,
  ];
  const sum = pure + white + black;
  return { pure: pure / sum, white: white / sum, black: black / sum };
}

function nearestOnEdges(
  p: Point,
  [a, b, c]: readonly [Point, Point, Point],
): Point {
  const candidates = [nearestOnSegment(p, a, b), nearestOnSegment(p, b, c)];
  candidates.push(nearestOnSegment(p, c, a));
  let best = candidates[0] ?? a;
  for (const candidate of candidates) {
    if (distance(p, candidate) < distance(p, best)) best = candidate;
  }
  return best;
}

function nearestOnSegment(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.min(
    1,
    Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)),
  );
  return { x: a.x + dx * t, y: a.y + dy * t };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export type Zone = "ring" | "triangle";

/** Which part of the wheel is at `p`, if any. */
export function zoneAt(p: Point, hue: number): Zone | undefined {
  const radius = Math.hypot(p.x, p.y);
  if (radius >= RING_INNER - HIT_MARGIN && radius <= 1 + HIT_MARGIN) {
    return "ring";
  }
  const vertices = triangleVertices(hue);
  const inside = barycentric(p, vertices).every((weight) => weight >= 0);
  if (inside || distance(p, nearestOnEdges(p, vertices)) <= HIT_MARGIN) {
    return "triangle";
  }
  return undefined;
}
