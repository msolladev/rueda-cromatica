/**
 * The web's languages: the same as the wheel's (docs/07 §9), each with its own
 * texts, the name it gives itself and the slug of its URLs.
 */
import { LOCALES, type Locale } from "@chromatic-wheel/color-wheel";
import { de } from "./locales/de.ts";
import { en } from "./locales/en.ts";
import { es } from "./locales/es.ts";
import { fr } from "./locales/fr.ts";
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
