import type { Model } from "../color/model.ts";
import type { Harmony, PlacedColor, Role } from "../harmony/harmony.ts";
import type { Light } from "../scheme/light.ts";
import type { Settings } from "./settings.ts";

/** The public result (docs/05 §6.7): the colors without their position. */
export interface Result {
  readonly harmony: Harmony;
  readonly model: Model;
  /** Only in the miniature scheme. */
  readonly light?: Light;
  readonly colors: readonly { readonly role: Role; readonly hex: string }[];
}

export function toResult(
  { model, harmony, light }: Settings,
  colors: readonly PlacedColor[],
): Result {
  const publicColors = colors.map(({ role, hex }) => ({ role, hex }));
  return harmony === "miniature-scheme"
    ? { harmony, model, light, colors: publicColors }
    : { harmony, model, colors: publicColors };
}
