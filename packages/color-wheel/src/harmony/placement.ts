import { toWheelColor } from "../color/convert.ts";
import type { Model } from "../color/model.ts";
import type { WheelColor } from "../color/wheel-color.ts";
import type { PlacedColor, Role } from "./harmony.ts";

/**
 * Coloca un color que sale de una mezcla. No sale de girar el tono, así que su
 * posición es la conversión de su hex a la rueda, con el tono de la base si
 * la mezcla queda sin tono.
 */
export function placeMix(
  role: Role,
  hex: string,
  base: WheelColor,
  model: Model,
): PlacedColor {
  return { role, hex, position: toWheelColor(hex, model, base.hue) };
}
