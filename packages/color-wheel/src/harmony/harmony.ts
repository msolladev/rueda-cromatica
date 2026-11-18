import { describeValue, oneOf } from "../errors.ts";
import type { WheelColor } from "../color/wheel-color.ts";

/**
 * The harmonies, plus the miniature scheme. The colors of each one and their
 * order are in the specification (docs/05 §4).
 */
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

/** One of the {@link HARMONIES}. */
export type Harmony = (typeof HARMONIES)[number];

/**
 * Role of each color in the result. Which roles each harmony has, and in
 * which order, is in the specification (docs/05 §4).
 */
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
