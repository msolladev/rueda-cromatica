// Digital model (docs/05 §3.1): the pure color is the HSL one with 100%
// saturation and 50% lightness, and the conversion from a hex is exact.

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
