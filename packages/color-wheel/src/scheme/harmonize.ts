import type { WheelColor } from "../color/wheel-color.ts";
import type { PlacedColor } from "../harmony/harmony.ts";
import { monochromaticColors } from "../harmony/monochromatic.ts";
import { rotationColors } from "../harmony/rotations.ts";
import { miniatureSchemeColors } from "./miniature-scheme.ts";
import type { Settings } from "./settings.ts";

export interface HarmonizeInput extends Settings {
  readonly color: WheelColor;
}

/**
 * El único cálculo de los colores de una armonía o del esquema de miniatura.
 * Lo usan `compute` y el componente. Recibe datos ya validados.
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
