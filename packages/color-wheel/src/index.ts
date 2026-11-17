// API pública del paquete (docs/05 §7). Los cálculos no usan el DOM.

import { toWheelColor } from "./color/convert.ts";
import { describeValue, isPlainObject } from "./errors.ts";
import { harmonize } from "./scheme/harmonize.ts";
import { toResult, type Result } from "./scheme/result.ts";
import { resolveSettings } from "./scheme/settings.ts";
import type { Model } from "./color/model.ts";
import type { Harmony } from "./harmony/harmony.ts";
import type { Light } from "./scheme/light.ts";

export { fromWheelColor, toWheelColor } from "./color/convert.ts";
export type { Model } from "./color/model.ts";
export type { WheelColor } from "./color/wheel-color.ts";
export type { Harmony, Role } from "./harmony/harmony.ts";
export type { Light } from "./scheme/light.ts";
export type { Result } from "./scheme/result.ts";

export interface ComputeInput {
  /** Color base en hex. */
  readonly color: string;
  /** Por defecto, `"ryb"`. */
  readonly model?: Model;
  /** Por defecto, `"miniature-scheme"`. */
  readonly harmony?: Harmony;
  /** Por defecto, `"warm"`. Solo cuenta en el esquema de miniatura. */
  readonly light?: Light;
}

const COMPUTE_KEYS: readonly string[] = ["color", "model", "harmony", "light"];

/** Calcula los colores de una armonía o del esquema de miniatura. */
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
