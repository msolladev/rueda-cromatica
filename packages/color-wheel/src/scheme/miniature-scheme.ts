import type { Model } from "../color/model.ts";
import type { WheelColor } from "../color/wheel-color.ts";
import type { PlacedColor } from "../harmony/harmony.ts";
import { placeMix } from "../harmony/placement.ts";
import { placeRotation } from "../harmony/rotations.ts";
import { lightHex, shadowHex, type Light } from "./light.ts";

/**
 * The miniature scheme: the base, its shadow, its light, the other two colors
 * of its triad and its complement, in that order (docs/05 §4).
 */
export function miniatureSchemeColors(
  base: WheelColor,
  model: Model,
  light: Light,
): PlacedColor[] {
  return [
    placeRotation(base, model, { role: "base", degrees: 0 }),
    placeMix("shadow", shadowHex(base, model), base, model),
    placeMix("light", lightHex(base, model, light), base, model),
    placeRotation(base, model, { role: "triad", degrees: 120 }),
    placeRotation(base, model, { role: "triad", degrees: 240 }),
    placeRotation(base, model, { role: "complement", degrees: 180 }),
  ];
}
