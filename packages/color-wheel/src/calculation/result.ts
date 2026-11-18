import type { Model } from "../color/model.ts";
import type { Harmony, PlacedColor, Role } from "../harmony/harmony.ts";
import type { Light } from "../scheme/light.ts";
import type { Settings } from "./settings.ts";

/**
 * The colors of a harmony or of the miniature scheme, and what they were
 * computed with.
 *
 * @example
 * ```ts
 * {
 *   harmony: "miniature-scheme",
 *   model: "ryb",
 *   light: "warm",
 *   colors: [
 *     { role: "base", hex: "#3daf44" },
 *     { role: "shadow", hex: "#5f8146" },
 *     { role: "light", hex: "#46b548" },
 *     { role: "triad", hex: "#7c2c88" },
 *     { role: "triad", hex: "#ea7821" },
 *     { role: "complement", hex: "#dc212f" },
 *   ],
 * }
 * ```
 */
export interface Result {
  /** The harmony computed. */
  readonly harmony: Harmony;
  /** The model it was computed with. */
  readonly model: Model;
  /** The light used. Only with the miniature scheme. */
  readonly light?: Light;
  /**
   * The colors, the base first. The roles and their order depend on the
   * harmony (docs/05 §4).
   */
  readonly colors: readonly {
    /** What the color is in the harmony. */
    readonly role: Role;
    /** The color, as `#rrggbb` in lowercase. */
    readonly hex: string;
  }[];
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
