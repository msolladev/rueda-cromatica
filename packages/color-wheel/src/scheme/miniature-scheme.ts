import type { Model } from "../color/model.ts";
import type { WheelColor } from "../color/wheel-color.ts";
import type { PlacedColor } from "../harmony/harmony.ts";
import { placeMix } from "../harmony/placement.ts";
import { placeRotation } from "../harmony/rotations.ts";
import { lightHex, shadowHex, type Light } from "./light.ts";

/**
 * El esquema de miniatura: la base, su sombra, su luz, los otros dos colores
 * de su tríada y su complementario, en ese orden (docs/05 §4).
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
