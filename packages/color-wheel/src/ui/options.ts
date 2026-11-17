import { assertModel, MODELS, type Model } from "../color/model.ts";
import { describeValue, isPlainObject } from "../errors.ts";
import { assertHarmony, HARMONIES, type Harmony } from "../harmony/harmony.ts";
import { assertLocale, type Locale } from "../i18n/locales.ts";
import { assertLight, type Light } from "../scheme/light.ts";
import { assertControl, type Control } from "./controls.ts";
import { assertPartialLabels, type PartialLabels } from "./labels.ts";

/** The properties of the component (docs/05 §6.4). */
export interface ColorWheelProperties {
  /** Base color in hex. */
  readonly color: string;
  /** Defaults to `"ryb"`. */
  readonly model: Model;
  /** Defaults to `"miniature-scheme"`. */
  readonly harmony: Harmony;
  /** Defaults to `"warm"`. Only used by the miniature scheme. */
  readonly light: Light;
  /** Harmonies offered by the selector, in order. Defaults to all. */
  readonly harmonies: readonly Harmony[];
  /** Models offered by the selector, in order. Defaults to both. */
  readonly models: readonly Model[];
  /** Defaults to the browser's language, or `"en"`. */
  readonly locale: Locale;
  /** Texts that replace those of the locale. Defaults to `{}`. */
  readonly labels: PartialLabels;
}

/** Options of the constructor: the properties, plus the controls' state. */
export interface ColorWheelOptions extends Partial<ColorWheelProperties> {
  readonly color: string;
  readonly hiddenControls?: readonly Control[];
  readonly disabledControls?: readonly Control[];
  /** `true` disables the whole wheel. */
  readonly disabled?: boolean;
}

/** Everything `getState` returns and `setState` restores. */
export interface ColorWheelState extends ColorWheelProperties {
  readonly hiddenControls: readonly Control[];
  readonly disabledControls: readonly Control[];
  readonly disabled: boolean;
}

export const PROPERTY_KEYS = [
  "color",
  "model",
  "harmony",
  "light",
  "harmonies",
  "models",
  "locale",
  "labels",
] as const satisfies readonly (keyof ColorWheelProperties)[];

export const STATE_KEYS = [
  ...PROPERTY_KEYS,
  "hiddenControls",
  "disabledControls",
  "disabled",
] as const satisfies readonly (keyof ColorWheelState)[];

/** Checks that `value` is an object with only the keys in `keys`. */
export function assertKeys(
  value: unknown,
  keys: readonly string[],
  name: string,
): asserts value is Readonly<Record<string, unknown>> {
  if (!isPlainObject(value)) {
    throw new TypeError(
      `Expected ${name} to be an object, received ${describeValue(value)}.`,
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) {
      throw new TypeError(
        `Unknown ${name} key ${JSON.stringify(key)}. Expected ${keys.join(", ")}.`,
      );
    }
  }
}

/** Validates one property, without the checks between properties. */
export function assertProperty(key: string, value: unknown): void {
  switch (key) {
    case "color":
      // The hex is validated when it is converted to the wheel.
      return;
    case "model":
      assertModel(value);
      return;
    case "harmony":
      assertHarmony(value);
      return;
    case "light":
      assertLight(value);
      return;
    case "harmonies":
      assertList(value, "harmonies", assertHarmony, true);
      return;
    case "models":
      assertList(value, "models", assertModel, true);
      return;
    case "locale":
      assertLocale(value);
      return;
    case "labels":
      assertPartialLabels(value);
      return;
    case "hiddenControls":
    case "disabledControls":
      assertList(value, key, assertControl, false);
      return;
    case "disabled":
      if (typeof value !== "boolean") {
        throw new TypeError(
          `Expected disabled to be a boolean, received ${describeValue(value)}.`,
        );
      }
      return;
  }
}

function assertList(
  value: unknown,
  name: string,
  assertItem: (item: unknown) => void,
  nonEmpty: boolean,
): void {
  if (!Array.isArray(value)) {
    throw new TypeError(
      `Expected ${name} to be an array, received ${describeValue(value)}.`,
    );
  }
  if (nonEmpty && value.length === 0) {
    throw new RangeError(`Expected ${name} to have at least one value.`);
  }
  const seen = new Set<unknown>();
  for (const item of value as unknown[]) {
    assertItem(item);
    if (seen.has(item)) {
      throw new RangeError(
        `Duplicate value ${describeValue(item)} in ${name}.`,
      );
    }
    seen.add(item);
  }
}

/** The first of `preferred` that is in `allowed`, or the first allowed. */
export function defaultFrom<T>(preferred: T, allowed: readonly T[]): T {
  return allowed.includes(preferred) ? preferred : (allowed[0] ?? preferred);
}

export const ALL_HARMONIES: readonly Harmony[] = HARMONIES;
export const ALL_MODELS: readonly Model[] = MODELS;
