import { describeValue, oneOf } from "../errors.ts";
import type { WheelColor } from "../color/wheel-color.ts";

/** The harmonies of docs/05 §4, plus the miniature scheme. */
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

/** Role of each color in the result (docs/05 §4). */
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

/** A result color, with its role, its hex and its position on the wheel. */
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
