import { assertModel, type Model } from "../color/model.ts";
import { assertHarmony, type Harmony } from "../harmony/harmony.ts";
import { assertLight, type Light } from "../scheme/light.ts";

/** Lo que se calcula, además del color base. */
export interface Settings {
  readonly model: Model;
  readonly harmony: Harmony;
  readonly light: Light;
}

/** Valores por defecto, los mismos en `compute` y en el componente (§6.4). */
export const DEFAULT_SETTINGS: Settings = {
  model: "ryb",
  harmony: "miniature-scheme",
  light: "warm",
};

/** Completa con los valores por defecto y valida lo recibido. */
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
