// Public API of the package (docs/05 §6 and §7). Only the component uses the
// DOM; the calculations also work in Node.

export { ColorWheel } from "./ui/color-wheel.ts";
export type {
  ChangeSource,
  ColorWheelEvent,
  ColorWheelEventDetail,
  ColorWheelEventMap,
  ColorWheelListener,
} from "./ui/color-wheel.ts";
export type {
  ColorWheelOptions,
  ColorWheelProperties,
  ColorWheelState,
} from "./ui/options.ts";
export { CONTROLS, type Control } from "./ui/controls.ts";
export {
  colorNames,
  labelsFor,
  type Labels,
  type PartialLabels,
} from "./ui/labels.ts";
export { LOCALES, resolveLocale, type Locale } from "./i18n/locales.ts";

export { compute, type ComputeInput } from "./calculation/compute.ts";
export { fromWheelColor, toWheelColor } from "./color/convert.ts";
export { MODELS, type Model } from "./color/model.ts";
export type { WheelColor } from "./color/wheel-color.ts";
export { HARMONIES, type Harmony, type Role } from "./harmony/harmony.ts";
export { LIGHTS, type Light } from "./scheme/light.ts";
export type { Result } from "./calculation/result.ts";
