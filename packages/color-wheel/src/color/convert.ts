import { digitalFromRgb, digitalPure } from "./digital.ts";
import { assertModel, type Model } from "./model.ts";
import {
  formatHexColor,
  normalizeHue,
  parseHexColor,
  type Rgb,
} from "./rgb.ts";
import { rybFromRgb, rybPure } from "./ryb.ts";
import { assertHue, assertWheelColor, type WheelColor } from "./wheel-color.ts";

/** Pure color of the hue `hue` on the model's ring. */
export function pureColor(hue: number, model: Model): Rgb {
  return model === "ryb" ? rybPure(hue) : digitalPure(hue);
}

/**
 * Converts a hex to the model's wheel (docs/05 §3). Colors without hue (pure
 * whites, grays and blacks) keep `previousHue`, the hue the wheel had.
 */
export function toWheelColor(
  hex: string,
  model: Model,
  previousHue = 0,
): WheelColor {
  const rgb = parseHexColor(hex);
  assertModel(model);
  assertHue(previousHue, "previousHue");
  return model === "ryb"
    ? rybFromRgb(rgb, previousHue)
    : digitalFromRgb(rgb, previousHue);
}

/**
 * Converts a wheel color to hex: the weighted sum, in sRGB, of the pure color,
 * white and black (docs/05 §2).
 */
export function fromWheelColor(color: WheelColor, model: Model): string {
  assertWheelColor(color);
  assertModel(model);
  const pure = pureColor(color.hue, model);
  const mix = (channel: number) => clamp01(color.pure * channel + color.white);
  return formatHexColor({ r: mix(pure.r), g: mix(pure.g), b: mix(pure.b) });
}

/** Rotates the hue by `degrees` and keeps the proportions. */
export function rotate(color: WheelColor, degrees: number): WheelColor {
  return { ...color, hue: normalizeHue(color.hue + degrees) };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
