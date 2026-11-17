import { describeValue, oneOf } from "../errors.ts";
import type { WheelColor } from "../color/wheel-color.ts";

/** Las armonías de docs/05 §4, además del esquema de miniatura. */
export const HARMONIES = [
  "complementary",
  "split-complementary",
  "analogous",
  "accented-analogous",
  "triad",
  "square",
  "rectangle",
  "monochromatic",
  "miniature-scheme",
] as const;

export type Harmony = (typeof HARMONIES)[number];

/** Papel de cada color en el resultado (docs/05 §4). */
export type Role =
  | "base"
  | "complement"
  | "split"
  | "analogous"
  | "accent"
  | "triad"
  | "square"
  | "tetrad"
  | "tint"
  | "tone"
  | "shade"
  | "shadow"
  | "light";

/** Un color del resultado, con su papel, su hex y su posición en la rueda. */
export interface PlacedColor {
  readonly role: Role;
  readonly hex: string;
  readonly position: WheelColor;
}

export function assertHarmony(value: unknown): asserts value is Harmony {
  if (!HARMONIES.includes(value as Harmony)) {
    throw new RangeError(
      `Unknown harmony ${describeValue(value)}. Expected ${oneOf(HARMONIES)}.`,
    );
  }
}
