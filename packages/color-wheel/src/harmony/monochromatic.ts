import { fromWheelColor } from "../color/convert.ts";
import type { Model } from "../color/model.ts";
import type { WheelColor } from "../color/wheel-color.ts";
import { mixPaint } from "../mixing/mix.ts";
import { VARIATION_RATIO } from "../mixing/ratios.ts";
import type { PlacedColor } from "./harmony.ts";
import { placeMix } from "./placement.ts";

/** Con qué se mezcla la base en cada variación (docs/05 §5.3). */
const VARIATIONS = [
  { role: "tint", with: "#ffffff" },
  { role: "tone", with: "#808080" },
  { role: "shade", with: "#000000" },
] as const;

/** La base y sus variaciones con blanco, gris y negro, en ese orden. */
export function monochromaticColors(
  base: WheelColor,
  model: Model,
): PlacedColor[] {
  const hex = fromWheelColor(base, model);
  return [
    { role: "base", hex, position: base },
    ...VARIATIONS.map((variation) =>
      placeMix(
        variation.role,
        mixPaint(hex, variation.with, VARIATION_RATIO),
        base,
        model,
      ),
    ),
  ];
}
