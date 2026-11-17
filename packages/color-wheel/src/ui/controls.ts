import { describeValue, oneOf } from "../errors.ts";

/** The controls of the component (docs/05 §6.3). The wheel itself is not one. */
export const CONTROLS = [
  "hex",
  "model",
  "harmony",
  "light",
  "results",
  "help",
] as const;

export type Control = (typeof CONTROLS)[number];

export function assertControl(value: unknown): asserts value is Control {
  if (!CONTROLS.includes(value as Control)) {
    throw new RangeError(
      `Unknown control ${describeValue(value)}. Expected ${oneOf(CONTROLS)}.`,
    );
  }
}
