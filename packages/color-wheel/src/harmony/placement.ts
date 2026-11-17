import { toWheelColor } from "../color/convert.ts";
import type { Model } from "../color/model.ts";
import type { WheelColor } from "../color/wheel-color.ts";
import type { PlacedColor, Role } from "./harmony.ts";

/**
 * Places a color that comes from a mix. It does not come from rotating the
 * hue, so its position is its hex converted to the wheel, with the base's hue
 * if the mix has no hue.
 */
export function placeMix(
  role: Role,
  hex: string,
  base: WheelColor,
  model: Model,
): PlacedColor {
  return { role, hex, position: toWheelColor(hex, model, base.hue) };
}
