import { describeValue, oneOf } from "../errors.ts";

/** Modelo de la rueda: RYB (el de la pintura física) o digital (RGB/HSL). */
export const MODELS = ["ryb", "digital"] as const;

export type Model = (typeof MODELS)[number];

export function assertModel(value: unknown): asserts value is Model {
  if (!MODELS.includes(value as Model)) {
    throw new RangeError(
      `Unknown model ${describeValue(value)}. Expected ${oneOf(MODELS)}.`,
    );
  }
}
