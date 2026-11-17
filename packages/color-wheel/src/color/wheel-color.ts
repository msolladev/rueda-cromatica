import { describeValue, isPlainObject } from "../errors.ts";

/**
 * A wheel color (docs/05 §2): the hue on the ring of the active model and the
 * proportions of pure color, white and black, which add up to 1.
 */
export interface WheelColor {
  /** Angle on the ring, in [0, 360). */
  readonly hue: number;
  readonly pure: number;
  readonly white: number;
  readonly black: number;
}

/** Tolerance for the proportions and their sum, due to floating-point rounding. */
const TOLERANCE = 1e-6;

export function assertHue(
  value: unknown,
  name: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(
      `Expected ${name} to be a finite number, received ${describeValue(value)}.`,
    );
  }
  if (value < 0 || value >= 360) {
    throw new RangeError(
      `Expected ${name} in [0, 360), received ${String(value)}.`,
    );
  }
}

export function assertWheelColor(value: unknown): asserts value is WheelColor {
  if (!isPlainObject(value)) {
    throw new TypeError(
      `Expected a wheel color { hue, pure, white, black }, received ${describeValue(value)}.`,
    );
  }
  assertHue(value.hue, "hue");
  let sum = 0;
  for (const key of ["pure", "white", "black"] as const) {
    const weight = value[key];
    if (typeof weight !== "number" || !Number.isFinite(weight)) {
      throw new TypeError(
        `Expected ${key} to be a finite number, received ${describeValue(weight)}.`,
      );
    }
    if (weight < -TOLERANCE || weight > 1 + TOLERANCE) {
      throw new RangeError(
        `Expected ${key} in [0, 1], received ${String(weight)}.`,
      );
    }
    sum += weight;
  }
  if (Math.abs(sum - 1) > TOLERANCE) {
    throw new RangeError(
      `Expected pure + white + black to be 1, received ${String(sum)}.`,
    );
  }
}
