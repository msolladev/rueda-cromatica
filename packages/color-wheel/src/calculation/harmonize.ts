import type { WheelColor } from "../color/wheel-color.ts";
import type { PlacedColor } from "../harmony/harmony.ts";
import { monochromaticColors } from "../harmony/monochromatic.ts";
import { rotationColors } from "../harmony/rotations.ts";
import { miniatureSchemeColors } from "../scheme/miniature-scheme.ts";
import type { Settings } from "./settings.ts";

export interface HarmonizeInput extends Settings {
  readonly color: WheelColor;
}

/**
 * The single calculation of the colors of a harmony or of the miniature
 * scheme. Used by `compute` and by the component. Receives validated data.
 */
export function harmonize({
  color,
  model,
  harmony,
  light,
}: HarmonizeInput): PlacedColor[] {
  switch (harmony) {
    case "monochromatic":
      return monochromaticColors(color, model);
    case "miniature-scheme":
      return miniatureSchemeColors(color, model, light);
    default:
      return rotationColors(color, model, harmony);
  }
}
