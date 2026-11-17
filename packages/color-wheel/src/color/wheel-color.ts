import { describeValue, isPlainObject } from "../errors.ts";

/**
 * Un color de la rueda (docs/05 §2): el tono en el anillo del modelo activo y
 * las proporciones de color puro, blanco y negro, que suman 1.
 */
export interface WheelColor {
  /** Ángulo en el anillo, en [0, 360). */
  readonly hue: number;
  readonly pure: number;
  readonly white: number;
  readonly black: number;
}

/** Margen para las proporciones y su suma, por el redondeo de los decimales. */
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
