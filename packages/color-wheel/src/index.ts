// Public API of the package (docs/05 §7). The calculations do not use the DOM.

import { toWheelColor } from "./color/convert.ts";
import { describeValue, isPlainObject } from "./errors.ts";
import { harmonize } from "./calculation/harmonize.ts";
import { toResult, type Result } from "./calculation/result.ts";
import { resolveSettings } from "./calculation/settings.ts";
import type { Model } from "./color/model.ts";
import type { Harmony } from "./harmony/harmony.ts";
import type { Light } from "./scheme/light.ts";

export { fromWheelColor, toWheelColor } from "./color/convert.ts";
export type { Model } from "./color/model.ts";
export type { WheelColor } from "./color/wheel-color.ts";
export type { Harmony, Role } from "./harmony/harmony.ts";
export type { Light } from "./scheme/light.ts";
export type { Result } from "./calculation/result.ts";

export interface ComputeInput {
  /** Base color in hex. */
  readonly color: string;
  /** Defaults to `"ryb"`. */
  readonly model?: Model;
  /** Defaults to `"miniature-scheme"`. */
  readonly harmony?: Harmony;
  /** Defaults to `"warm"`. Only used by the miniature scheme. */
  readonly light?: Light;
}

const COMPUTE_KEYS: readonly string[] = ["color", "model", "harmony", "light"];

/** Computes the colors of a harmony or of the miniature scheme. */
export function compute(input: ComputeInput): Result {
  if (!isPlainObject(input)) {
    throw new TypeError(
      `Expected an object { color, model, harmony, light }, received ${describeValue(input)}.`,
    );
  }
  for (const key of Object.keys(input)) {
    if (!COMPUTE_KEYS.includes(key)) {
      throw new TypeError(
        `Unknown option ${JSON.stringify(key)}. Expected ${COMPUTE_KEYS.join(", ")}.`,
      );
    }
  }
  const settings = resolveSettings(input);
  const colors = harmonize({
    ...settings,
    color: toWheelColor(input.color, settings.model),
  });
  return toResult(settings, colors);
}
