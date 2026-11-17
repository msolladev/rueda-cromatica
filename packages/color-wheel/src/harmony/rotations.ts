import { fromWheelColor, rotate } from "../color/convert.ts";
import type { Model } from "../color/model.ts";
import type { WheelColor } from "../color/wheel-color.ts";
import type { Harmony, PlacedColor, Role } from "./harmony.ts";

/** Harmonies that only rotate the base's hue. */
export type RotationHarmony = Exclude<
  Harmony,
  "monochromatic" | "miniature-scheme"
>;

interface Rotation {
  readonly role: Role;
  /** Degrees the hue rotates; one step of the 12-hue wheel is 30°. */
  readonly degrees: number;
}

/** Colors of each harmony, in result order (docs/05 §4). */
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
    // Square and rectangle, in pairs of opposites.
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

/** Places a rotated color: it keeps the base's proportions. */
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
