import { assertModel, type Model } from "../color/model.ts";
import { assertHarmony, type Harmony } from "../harmony/harmony.ts";
import { assertLight, type Light } from "../scheme/light.ts";

/** What is computed, besides the base color. */
export interface Settings {
  readonly model: Model;
  readonly harmony: Harmony;
  readonly light: Light;
}

/** Defaults, the same in `compute` and in the component (§6.4). */
export const DEFAULT_SETTINGS: Settings = {
  model: "ryb",
  harmony: "miniature-scheme",
  light: "warm",
};

/** Fills in the defaults and validates the input. */
export function resolveSettings(input: {
  readonly model?: unknown;
  readonly harmony?: unknown;
  readonly light?: unknown;
}): Settings {
  const {
    model = DEFAULT_SETTINGS.model,
    harmony = DEFAULT_SETTINGS.harmony,
    light = DEFAULT_SETTINGS.light,
  } = input;
  assertModel(model);
  assertHarmony(harmony);
  assertLight(light);
  return { model, harmony, light };
}
