import { toWheelColor } from "../color/convert.ts";
import type { Model } from "../color/model.ts";
import { describeValue, isPlainObject } from "../errors.ts";
import type { Harmony } from "../harmony/harmony.ts";
import type { Light } from "../scheme/light.ts";
import { harmonize } from "./harmonize.ts";
import { toResult, type Result } from "./result.ts";
import { resolveSettings } from "./settings.ts";

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
