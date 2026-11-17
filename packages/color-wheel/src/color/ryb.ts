// Modelo RYB (docs/05 §3.2). Los colores puros salen de las esquinas del cubo
// de Gossett y Chen (2004), apéndice A, tal como las recoge la tabla de
// docs/05 §3.2. Entre dos esquinas, el color puro se interpola de forma lineal.

import { hsvHue, type Rgb } from "./rgb.ts";
import type { WheelColor } from "./wheel-color.ts";

/** Las seis esquinas de color, en el orden del anillo, cada 60°. */
const CORNERS: readonly Rgb[] = [
  { r: 1, g: 0, b: 0 }, // rojo, 0°
  { r: 1, g: 0.5, b: 0 }, // naranja, 60°
  { r: 1, g: 1, b: 0 }, // amarillo, 120°
  { r: 0, g: 0.66, b: 0.2 }, // verde, 180°
  { r: 0.163, g: 0.373, b: 0.6 }, // azul, 240°
  { r: 0.5, g: 0, b: 0.5 }, // violeta, 300°
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

/** Color puro del tono RYB `hue`, en [0, 360). */
export function rybPure(hue: number): Rgb {
  const segment = Math.floor(hue / SEGMENT);
  const t = (hue - segment * SEGMENT) / SEGMENT;
  return lerp(corner(segment), corner(segment + 1), t);
}

/**
 * Tono HSV del color puro RYB, desenrollado para que crezca de 0 a 360 en
 * todo el anillo: el último tramo (violeta → rojo) termina en 360, no en 0.
 */
export function rybPureHsvHue(hue: number): number {
  const h = hsvHue(rybPure(hue)) ?? 0;
  return hue >= SEGMENT * (CORNERS.length - 1) && h < 180 ? h + 360 : h;
}

const ITERATIONS = 50;

/**
 * Invierte la correspondencia: el tono RYB cuyo color puro tiene el tono HSV
 * `target`. Como la correspondencia es creciente, basta con buscar el tramo y
 * dividirlo por la mitad hasta la precisión de los decimales.
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

/** Tono HSV al final de un tramo; el del último es 360. */
function rybEndHue(hue: number): number {
  return hue >= 360 ? 360 : rybPureHsvHue(hue);
}

/**
 * Proporciones del punto del triángulo (puro, blanco y negro) más cercano a
 * `target`, por mínimos cuadrados en sRGB y con pesos no negativos. Si
 * `target` queda fuera del triángulo, es el punto alcanzable más cercano.
 */
export function nearestInTriangle(
  target: Rgb,
  pure: Rgb,
): Omit<WheelColor, "hue"> {
  // El negro es el origen, así que el punto es pure · P + white · W.
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
  // Los tres lados: negro-blanco, negro-puro y blanco-puro.
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
