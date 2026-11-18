/**
 * The preferences kept between visits, in `localStorage` (docs/07 §6). What
 * is read is validated: if it is corrupt, from another version or not valid,
 * it is discarded and the defaults are used.
 */
import {
  HARMONIES,
  LIGHTS,
  LOCALES,
  MODELS,
  type Harmony,
  type Light,
  type Locale,
  type Model,
} from "@chromatic-wheel/color-wheel";
import { paintTypeSchema, type PaintType } from "@chromatic-wheel/domain";
import { isTheme } from "../features/theme/theme.ts";
import { STORAGE_KEY } from "./before-paint.ts";
import {
  EXTRA_PAINT_TYPES,
  type Filters,
  type Preferences,
  type View,
  type WheelPreferences,
} from "./state.ts";

type Unknown = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Unknown =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isOneOf = <T extends string>(
  options: readonly T[],
  value: unknown,
): value is T => options.includes(value as T);

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function parseFilters(value: unknown): Filters | null {
  if (!isRecord(value)) return null;
  const { excludedBrands, extraTypes, includeMetallic, includeDiscontinued } =
    value;
  if (
    !isStringArray(excludedBrands) ||
    !isStringArray(extraTypes) ||
    typeof includeMetallic !== "boolean" ||
    typeof includeDiscontinued !== "boolean"
  ) {
    return null;
  }
  const types = extraTypes.filter((type) =>
    isOneOf<PaintType>(paintTypeSchema.options, type),
  );
  if (types.length !== extraTypes.length) return null;
  return {
    excludedBrands,
    // A type that is a default one again is simply dropped.
    extraTypes: types.filter((type) => EXTRA_PAINT_TYPES.includes(type)),
    includeMetallic,
    includeDiscontinued,
  };
}

function parseWheel(value: unknown): WheelPreferences | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const { color, model, harmony, light } = value;
  if (
    typeof color !== "string" ||
    !HEX.test(color) ||
    !isOneOf<Model>(MODELS, model) ||
    !isOneOf<Harmony>(HARMONIES, harmony) ||
    !isOneOf<Light>(LIGHTS, light)
  ) {
    return undefined;
  }
  return { color, model, harmony, light };
}

/** The preferences in `value`, or `null` if anything is not valid. */
export function parsePreferences(value: unknown): Preferences | null {
  if (!isRecord(value)) return null;
  const filters = parseFilters(value["filters"]);
  const wheel = parseWheel(value["wheel"]);
  const { view, theme, locale, installDismissed } = value;
  if (
    filters === null ||
    wheel === undefined ||
    !isOneOf<View>(["by-brand", "overall"], view) ||
    !isTheme(theme) ||
    (locale !== null && !isOneOf<Locale>(LOCALES, locale)) ||
    typeof installDismissed !== "boolean"
  ) {
    return null;
  }
  return { filters, view, theme, locale, installDismissed, wheel };
}

/** Reads the saved preferences; `null` if there are none or they are not valid. */
export function readPreferences(storage: Storage): Preferences | null {
  try {
    const text = storage.getItem(STORAGE_KEY);
    return text === null ? null : parsePreferences(JSON.parse(text));
  } catch {
    // Blocked storage or corrupt JSON: as if nothing were saved.
    return null;
  }
}

/** Saves the preferences. A blocked or full storage is ignored. */
export function writePreferences(
  storage: Storage,
  preferences: Preferences,
): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Nothing to do: the preferences only last for this visit.
  }
}
