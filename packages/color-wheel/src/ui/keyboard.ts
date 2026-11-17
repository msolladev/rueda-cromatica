// Keyboard steps of the ring and the triangle (docs/05 §6.2).

import { normalizeHue } from "../color/rgb.ts";
import type { WheelColor } from "../color/wheel-color.ts";

const HUE_STEP = 1;
const HUE_SHIFT_STEP = 10;
/** One step of the 12-hue wheel. */
const HUE_PAGE_STEP = 30;

const PROPORTION_STEP = 0.01;
const PROPORTION_SHIFT_STEP = 0.1;

interface Key {
  readonly key: string;
  readonly shiftKey: boolean;
}

/** The new hue for a key on the ring, or `undefined` if the key does nothing. */
export function ringKey(
  hue: number,
  { key, shiftKey }: Key,
): number | undefined {
  const step = shiftKey ? HUE_SHIFT_STEP : HUE_STEP;
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return normalizeHue(hue + step);
    case "ArrowLeft":
    case "ArrowDown":
      return normalizeHue(hue - step);
    case "PageUp":
      return normalizeHue(hue + HUE_PAGE_STEP);
    case "PageDown":
      return normalizeHue(hue - HUE_PAGE_STEP);
    default:
      return undefined;
  }
}

/**
 * The new proportions for a key on the triangle, or `undefined` if the key
 * does nothing. Right and Left change the pure color and keep the ratio of
 * white to black; Up and Down move white to black and keep the pure color.
 */
export function triangleKey(
  color: WheelColor,
  { key, shiftKey }: Key,
): Omit<WheelColor, "hue"> | undefined {
  const step = shiftKey ? PROPORTION_SHIFT_STEP : PROPORTION_STEP;
  switch (key) {
    case "ArrowRight":
      return withPure(color, color.pure + step);
    case "ArrowLeft":
      return withPure(color, color.pure - step);
    case "ArrowUp":
      return withWhite(color, color.white + step);
    case "ArrowDown":
      return withWhite(color, color.white - step);
    default:
      return undefined;
  }
}

function withPure(color: WheelColor, value: number): Omit<WheelColor, "hue"> {
  const pure = round(clamp(value, 0, 1));
  const gray = color.white + color.black;
  const whiteShare = gray > 0 ? color.white / gray : 0.5;
  const white = round((1 - pure) * whiteShare);
  return { pure, white, black: Math.max(0, 1 - pure - white) };
}

function withWhite(color: WheelColor, value: number): Omit<WheelColor, "hue"> {
  const white = round(clamp(value, 0, 1 - color.pure));
  return {
    pure: color.pure,
    white,
    black: Math.max(0, 1 - color.pure - white),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Removes the floating-point noise of repeated steps. */
function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
