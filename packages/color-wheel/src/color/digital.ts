// Modelo digital (docs/05 §3.1): el color puro es el de HSL con saturación
// 100 % y luminosidad 50 %, y la conversión desde un hex es exacta.

import { hslPure, hsvHue, type Rgb } from "./rgb.ts";
import type { WheelColor } from "./wheel-color.ts";

export const digitalPure = hslPure;

export function digitalFromRgb(rgb: Rgb, previousHue: number): WheelColor {
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  return {
    hue: hsvHue(rgb) ?? previousHue,
    pure: max - min,
    white: min,
    black: 1 - max,
  };
}
