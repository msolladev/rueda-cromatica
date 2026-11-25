/**
 * The web's languages: the same as the wheel's (docs/07 §9), each with its own
 * texts, the name it gives itself and the slug of its URLs.
 */
import { LOCALES, type Locale } from "@chromatic-wheel/color-wheel";
import { ca } from "./locales/ca.ts";
import { de } from "./locales/de.ts";
import { en } from "./locales/en.ts";
import { es } from "./locales/es.ts";
import { eu } from "./locales/eu.ts";
import { fr } from "./locales/fr.ts";
import { gl } from "./locales/gl.ts";
import { it } from "./locales/it.ts";
import { ja } from "./locales/ja.ts";
import { ko } from "./locales/ko.ts";
import { ptBR } from "./locales/pt-BR.ts";
import { ru } from "./locales/ru.ts";
import { zhHans } from "./locales/zh-Hans.ts";
import type { Messages } from "./messages.ts";

export { LOCALES, type Locale };

const MESSAGES: Readonly<Record<Locale, Messages>> = {
  en,
  es,
  ca,
  eu,
  gl,
  fr,
  de,
  it,
  "pt-BR": ptBR,
  ru,
  "zh-Hans": zhHans,
  ja,
  ko,
};

/** Each language's name in that language, as the selector shows it. */
export const LANGUAGE_NAMES: Readonly<Record<Locale, string>> = {
  en: "English",
  es: "Español",
  ca: "Català",
  eu: "Euskara",
  gl: "Galego",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  "pt-BR": "Português (Brasil)",
  ru: "Русский",
  "zh-Hans": "简体中文",
  ja: "日本語",
  ko: "한국어",
};

export function messagesOf(locale: Locale): Messages {
  return MESSAGES[locale];
}

/** The URL segment of a locale: its tag in lower case (`pt-BR` → `pt-br`). */
export function localeSlug(locale: Locale): string {
  return locale.toLowerCase();
}

/** The locale of a URL segment, or `undefined`. */
export function localeOfSlug(slug: string): Locale | undefined {
  return LOCALES.find((locale) => localeSlug(locale) === slug);
}

/** What separates the parts of a line: «Vallejo · Game Color · 72.059». */
export const SEPARATOR = " · ";

/**
 * A ΔE as the web writes it everywhere: with one decimal, in the page's
 * language («7,6» in Spanish, «7.6» in English).
 */
export function formatDeltaE(deltaE: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(deltaE);
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

/**
 * Like {@link format}, but a value can be anything, such as a link: returns
 * the pieces in order, the text between the values as strings.
 */
export function formatParts<T>(
  template: string,
  values: Readonly<Record<string, T>>,
): readonly (string | T)[] {
  const parts: (string | T)[] = [];
  let at = 0;
  for (const match of template.matchAll(/\{(\w+)\}/g)) {
    const name = match[1] ?? "";
    if (!(name in values)) continue;
    if (match.index > at) parts.push(template.slice(at, match.index));
    parts.push(values[name] as T);
    at = match.index + match[0].length;
  }
  if (at < template.length) parts.push(template.slice(at));
  return parts;
}
