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
 * Converts a hex to the model's wheel. In RYB, a hex that the triangle cannot
 * reach, such as an intense cyan, becomes the closest color it reaches.
 *
 * @param hex - `#rgb` or `#rrggbb`.
 * @param model - The model of the wheel.
 * @param previousHue - The hue that colors without hue (pure whites, grays
 *   and blacks) keep, usually the hue the wheel had. In [0, 360).
 * @throws TypeError if `hex` is not a string or `previousHue` is not a finite
 *   number.
 * @throws RangeError if `hex`, `model` or `previousHue` are not valid.
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
 * white and black.
 *
 * @returns The color, as `#rrggbb` in lowercase.
 * @throws TypeError if `color` is not an object or a value is not a finite
 *   number.
 * @throws RangeError if `hue` is not in [0, 360), a proportion is not in
 *   [0, 1], the proportions do not add up to 1, or `model` is not valid.
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
