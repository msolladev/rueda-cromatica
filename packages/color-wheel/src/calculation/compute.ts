import { toWheelColor } from "../color/convert.ts";
import type { Model } from "../color/model.ts";
import { describeValue, isPlainObject } from "../errors.ts";
import type { Harmony } from "../harmony/harmony.ts";
import type { Light } from "../scheme/light.ts";
import { harmonize } from "./harmonize.ts";
import { toResult, type Result } from "./result.ts";
import { resolveSettings } from "./settings.ts";

/** What {@link compute} computes with. Only `color` is required. */
export interface ComputeInput {
  /** Base color: `#rgb` or `#rrggbb`. */
  readonly color: string;
  /**
   * The model of the wheel.
   *
   * @defaultValue `"ryb"`
   */
  readonly model?: Model;
  /**
   * The harmony to compute.
   *
   * @defaultValue `"miniature-scheme"`
   */
  readonly harmony?: Harmony;
  /**
   * The light of the miniature scheme. It is always validated, but only
   * appears in the result with the miniature scheme.
   *
   * @defaultValue `"warm"`
   */
  readonly light?: Light;
}

const COMPUTE_KEYS: readonly string[] = ["color", "model", "harmony", "light"];

/**
 * Computes the colors of a harmony or of the miniature scheme, without the
 * component and without the DOM. It gives the same result as the component
 * with the same properties.
 *
 * @throws TypeError if `input` is not an object, it has an unknown key, or
 *   `color` is not a string.
 * @throws RangeError if a value is not valid.
 *
 * @example
 * ```ts
 * compute({ color: "#3daf44", harmony: "triad" });
 * ```
 */
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
