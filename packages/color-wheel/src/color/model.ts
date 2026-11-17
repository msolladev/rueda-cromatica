import { describeValue, oneOf } from "../errors.ts";

/** Wheel model: RYB (that of physical paint) or digital (RGB/HSL). */
export const MODELS = ["ryb", "digital"] as const;

export type Model = (typeof MODELS)[number];

export function assertModel(value: unknown): asserts value is Model {
  if (!MODELS.includes(value as Model)) {
    throw new RangeError(
      `Unknown model ${describeValue(value)}. Expected ${oneOf(MODELS)}.`,
    );
  }
}
