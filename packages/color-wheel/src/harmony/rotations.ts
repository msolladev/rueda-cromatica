import { fromWheelColor, rotate } from "../color/convert.ts";
import type { Model } from "../color/model.ts";
import type { WheelColor } from "../color/wheel-color.ts";
import type { Harmony, PlacedColor, Role } from "./harmony.ts";

/** Armonías que solo giran el tono de la base. */
export type RotationHarmony = Exclude<
  Harmony,
  "monochromatic" | "miniature-scheme"
>;

interface Rotation {
  readonly role: Role;
  /** Grados que se gira el tono; un paso de la rueda de 12 tonos son 30°. */
  readonly degrees: number;
}

/** Colores de cada armonía, en el orden del resultado (docs/05 §4). */
export const ROTATIONS: Readonly<Record<RotationHarmony, readonly Rotation[]>> =
  {
    complementary: [
      { role: "base", degrees: 0 },
      { role: "complement", degrees: 180 },
    ],
    "split-complementary": [
      { role: "base", degrees: 0 },
      { role: "split", degrees: 150 },
      { role: "split", degrees: 210 },
    ],
    analogous: [
      { role: "base", degrees: 0 },
      { role: "analogous", degrees: -30 },
      { role: "analogous", degrees: 30 },
    ],
    "accented-analogous": [
      { role: "base", degrees: 0 },
      { role: "analogous", degrees: -30 },
      { role: "analogous", degrees: 30 },
      { role: "accent", degrees: 180 },
    ],
    triad: [
      { role: "base", degrees: 0 },
      { role: "triad", degrees: 120 },
      { role: "triad", degrees: 240 },
    ],
    // Cuadrado y tétrada rectangular, por parejas de opuestos.
    square: [
      { role: "base", degrees: 0 },
      { role: "complement", degrees: 180 },
      { role: "square", degrees: 90 },
      { role: "square", degrees: 270 },
    ],
    rectangle: [
      { role: "base", degrees: 0 },
      { role: "complement", degrees: 180 },
      { role: "tetrad", degrees: 60 },
      { role: "tetrad", degrees: 240 },
    ],
  };

/** Coloca un color girado: conserva las proporciones de la base. */
export function placeRotation(
  base: WheelColor,
  model: Model,
  { role, degrees }: Rotation,
): PlacedColor {
  const position = rotate(base, degrees);
  return { role, hex: fromWheelColor(position, model), position };
}

export function rotationColors(
  base: WheelColor,
  model: Model,
  harmony: RotationHarmony,
): PlacedColor[] {
  return ROTATIONS[harmony].map((rotation) =>
    placeRotation(base, model, rotation),
  );
}
