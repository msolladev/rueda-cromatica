import type { Model } from "../color/model.ts";
import { describeValue, isPlainObject } from "../errors.ts";
import type { Harmony, Role } from "../harmony/harmony.ts";
import type { Locale } from "../i18n/locales.ts";
import { TEXTS } from "../i18n/texts.ts";
import type { Light } from "../scheme/light.ts";
import type { Control } from "./controls.ts";

/**
 * The component's texts (docs/05 §6.8). The keys come from the lists of the
 * code (harmonies, roles, models, lights and controls), so a missing text in
 * a locale file is a compile error.
 */
export interface Labels {
  readonly harmony: Readonly<Record<Harmony, string>>;
  readonly role: Readonly<Record<Role, string>>;
  readonly model: Readonly<Record<Model, string>>;
  readonly light: Readonly<Record<Light, string>>;
  readonly control: Readonly<Record<Control, string>>;
  readonly wheel: {
    /** Accessible name of the whole component. */
    readonly label: string;
    readonly ring: string;
    /** `{hue}`: the hue in degrees. */
    readonly ringValue: string;
    readonly triangle: string;
    /** `{pure}`, `{white}`, `{black}`: percentages. */
    readonly triangleValue: string;
    readonly ringKeys: string;
    readonly triangleKeys: string;
    readonly pointerHelp: string;
    readonly touchHelp: string;
    readonly keyboardHelp: string;
    /** Accessible name of the button that closes the help. */
    readonly helpClose: string;
    readonly hexInvalid: string;
    /** `{count}`: number of colors; `{harmony}`: its name. */
    readonly resultsUpdated: string;
  };
}

/** Texts that replace those of the locale, with the same shape. */
export type PartialLabels = {
  readonly [Group in keyof Labels]?: Partial<Labels[Group]>;
};

const LOCALE_LABELS: Readonly<Record<Locale, Labels>> = TEXTS;

/** Checks every key against the English texts, and names the wrong one. */
export function assertPartialLabels(
  value: unknown,
): asserts value is PartialLabels {
  if (!isPlainObject(value)) {
    throw new TypeError(
      `Expected labels to be an object, received ${describeValue(value)}.`,
    );
  }
  const reference = new Map<string, object>(Object.entries(LOCALE_LABELS.en));
  for (const [group, texts] of Object.entries(value)) {
    const known = reference.get(group);
    if (known === undefined) {
      throw new RangeError(`Unknown label ${JSON.stringify(group)}.`);
    }
    if (!isPlainObject(texts)) {
      throw new TypeError(
        `Expected labels.${group} to be an object, received ${describeValue(texts)}.`,
      );
    }
    for (const [key, text] of Object.entries(texts)) {
      if (!(key in known)) {
        throw new RangeError(`Unknown label "${group}.${key}".`);
      }
      if (typeof text !== "string") {
        throw new TypeError(
          `Expected label "${group}.${key}" to be a string, received ${describeValue(text)}.`,
        );
      }
    }
  }
}

/** The texts of the locale, with those of `labels` replaced. */
export function mergeLabels(locale: Locale, labels: PartialLabels): Labels {
  const base = LOCALE_LABELS[locale];
  return {
    harmony: { ...base.harmony, ...labels.harmony },
    role: { ...base.role, ...labels.role },
    model: { ...base.model, ...labels.model },
    light: { ...base.light, ...labels.light },
    control: { ...base.control, ...labels.control },
    wheel: { ...base.wheel, ...labels.wheel },
  };
}

/** Replaces each `{name}` of `template` with its value. */
export function format(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}
