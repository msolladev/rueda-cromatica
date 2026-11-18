import type { Model } from "../color/model.ts";
import { describeValue, isPlainObject } from "../errors.ts";
import type { Harmony, Role } from "../harmony/harmony.ts";
import { assertLocale, type Locale } from "../i18n/locales.ts";
import { TEXTS } from "../i18n/texts.ts";
import type { Light } from "../scheme/light.ts";
import type { Control } from "./controls.ts";

/**
 * The component's texts, in groups. The keys come from the lists of the code
 * (harmonies, roles, models, lights and controls), so every locale has every
 * text. Some texts have placeholders, such as `{hue}`, that the component
 * replaces with their value.
 */
export interface Labels {
  /** The name of each harmony, in the selector and the announcements. */
  readonly harmony: Readonly<Record<Harmony, string>>;
  /** The name of each role, in the list of results. */
  readonly role: Readonly<Record<Role, string>>;
  /** The name of each model, in its selector. */
  readonly model: Readonly<Record<Model, string>>;
  /** The name of each light, in its selector. */
  readonly light: Readonly<Record<Light, string>>;
  /** The label of each control. `help` is also the title of the help. */
  readonly control: Readonly<Record<Control, string>>;
  /** The texts of the wheel itself: accessible names, values, help and errors. */
  readonly wheel: {
    /** Accessible name of the whole component. */
    readonly label: string;
    /** Accessible name of the ring slider. */
    readonly ring: string;
    /** Value that the ring announces. `{hue}`: the hue in degrees. */
    readonly ringValue: string;
    /** Accessible name of the triangle slider. */
    readonly triangle: string;
    /**
     * Value that the triangle announces. `{pure}`, `{white}`, `{black}`: the
     * proportions, as whole percentages.
     */
    readonly triangleValue: string;
    /** The ring's keys, linked to its slider by `aria-describedby`. */
    readonly ringKeys: string;
    /** The triangle's keys, linked to its slider by `aria-describedby`. */
    readonly triangleKeys: string;
    /** Help on using the wheel with a mouse or a pen. */
    readonly pointerHelp: string;
    /** Help on using the wheel with a finger. */
    readonly touchHelp: string;
    /** Help on using the wheel with the keyboard. */
    readonly keyboardHelp: string;
    /** Accessible name of the button that closes the help. */
    readonly helpClose: string;
    /** Error shown under the hex field when the typed hex is not valid. */
    readonly hexInvalid: string;
    /**
     * Announced when a control changes the colors. `{count}`: number of
     * colors; `{harmony}`: its name.
     */
    readonly resultsUpdated: string;
  };
}

/**
 * Texts that replace those of the locale, with the same shape as
 * {@link Labels} and only the texts to replace.
 *
 * @example
 * ```ts
 * const labels: PartialLabels = { harmony: { triad: "Palette" } };
 * ```
 */
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

/**
 * The texts that the wheel uses in a locale, without creating a wheel: the
 * names of the harmonies, roles, models and lights, and the rest of
 * {@link Labels}. A page can use them to name the wheel's colors in its own
 * content, for example when it renders on a server.
 *
 * @param locale - One of the included locales.
 * @returns A new object with every text of the locale.
 * @throws RangeError if `locale` is not an included locale.
 *
 * @example
 * ```ts
 * labelsFor("es").harmony.triad; // "Tríada"
 * labelsFor("en").role.shadow; // "Shadow"
 * ```
 */
export function labelsFor(locale: Locale): Labels {
  assertLocale(locale);
  return mergeLabels(locale, {});
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
