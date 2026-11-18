import { assertModel, MODELS, type Model } from "../color/model.ts";
import { describeValue, isPlainObject } from "../errors.ts";
import { assertHarmony, HARMONIES, type Harmony } from "../harmony/harmony.ts";
import { assertLocale, type Locale } from "../i18n/locales.ts";
import { assertLight, type Light } from "../scheme/light.ts";
import { assertControl, type Control } from "./controls.ts";
import { assertPartialLabels, type PartialLabels } from "./labels.ts";

/**
 * The properties of the component. The same names are the constructor's
 * options and the class's properties, where their defaults, valid values and
 * errors are documented ({@link ColorWheel.color} and the following).
 */
export interface ColorWheelProperties {
  /** Base color: `#rgb` or `#rrggbb`. See {@link ColorWheel.color}. */
  readonly color: string;
  /** See {@link ColorWheel.model}. */
  readonly model: Model;
  /** See {@link ColorWheel.harmony}. */
  readonly harmony: Harmony;
  /** See {@link ColorWheel.light}. */
  readonly light: Light;
  /** See {@link ColorWheel.harmonies}. */
  readonly harmonies: readonly Harmony[];
  /** See {@link ColorWheel.models}. */
  readonly models: readonly Model[];
  /** See {@link ColorWheel.locale}. */
  readonly locale: Locale;
  /** See {@link ColorWheel.labels}. */
  readonly labels: PartialLabels;
}

/**
 * Options of the constructor: the properties, of which only `color` is
 * required, plus the initial state of the controls.
 */
export interface ColorWheelOptions extends Partial<ColorWheelProperties> {
  /** Base color: `#rgb` or `#rrggbb`. Required. */
  readonly color: string;
  /**
   * Controls hidden from the start, without repeated values.
   *
   * @defaultValue `[]`
   */
  readonly hiddenControls?: readonly Control[];
  /**
   * Controls disabled from the start, without repeated values.
   *
   * @defaultValue `[]`
   */
  readonly disabledControls?: readonly Control[];
  /**
   * `true` disables the whole wheel, as {@link ColorWheel.disable}.
   *
   * @defaultValue `false`
   */
  readonly disabled?: boolean;
}

/**
 * Everything {@link ColorWheel.getState} returns and
 * {@link ColorWheel.setState} restores: the properties and the state of the
 * controls.
 */
export interface ColorWheelState extends ColorWheelProperties {
  /** The hidden controls, in the order of {@link CONTROLS}. */
  readonly hiddenControls: readonly Control[];
  /** The disabled controls, in the order of {@link CONTROLS}. */
  readonly disabledControls: readonly Control[];
  /** Whether the whole wheel is disabled. */
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
