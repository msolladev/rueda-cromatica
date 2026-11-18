import { describeValue, oneOf } from "../errors.ts";

/**
 * The controls of the component, which can be hidden and disabled one by one:
 *
 * - `hex`: the field to read or type the base color;
 * - `model`: the model selector;
 * - `harmony`: the harmony selector, with those of `harmonies`;
 * - `light`: the light selector, only visible with the miniature scheme;
 * - `results`: the list of the resulting colors, with their role;
 * - `help`: the button that opens how to use the wheel.
 *
 * The ring and the triangle are the wheel itself, not controls.
 */
export const CONTROLS = [
  "hex",
  "model",
  "harmony",
  "light",
  "results",
  "help",
] as const;

/** One of the {@link CONTROLS}. */
export type Control = (typeof CONTROLS)[number];

export function assertControl(value: unknown): asserts value is Control {
  if (!CONTROLS.includes(value as Control)) {
    throw new RangeError(
      `Unknown control ${describeValue(value)}. Expected ${oneOf(CONTROLS)}.`,
    );
  }
}
