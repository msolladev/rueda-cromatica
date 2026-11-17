import { describeValue, oneOf } from "../errors.ts";
import de from "./locales/de.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import it from "./locales/it.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import ptBR from "./locales/pt-BR.json";
import ru from "./locales/ru.json";
import zhHans from "./locales/zh-Hans.json";

/** Included locales (docs/05 §6.8). */
export const LOCALES = [
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt-BR",
  "ru",
  "zh-Hans",
  "ja",
  "ko",
] as const;

export type Locale = (typeof LOCALES)[number];

/** The wheel's texts. English is the reference: its keys are the list. */
export type Labels = typeof en;

export const LABELS: Readonly<Record<Locale, Labels>> = {
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

export const DEFAULT_LOCALE: Locale = "en";

export function assertLocale(value: unknown): asserts value is Locale {
  if (!LOCALES.includes(value as Locale)) {
    throw new RangeError(
      `Unknown locale ${describeValue(value)}. Expected ${oneOf(LOCALES)}.`,
    );
  }
}

/** Base language subtag: `pt-PT` → `pt`. */
function baseLanguage(tag: string): string {
  return tag.split("-")[0]?.toLowerCase() ?? "";
}

/**
 * The default locale (docs/05 §6.8): the first of `preferred` that matches an
 * included one, first exactly and then by base language (`pt-PT` → `pt-BR`).
 * If none matches, English. The component passes `navigator.languages`.
 */
export function resolveLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const lower = tag.toLowerCase();
    const exact = LOCALES.find((locale) => locale.toLowerCase() === lower);
    if (exact !== undefined) return exact;
    const base = baseLanguage(tag);
    const byBase = LOCALES.find((locale) => baseLanguage(locale) === base);
    if (byBase !== undefined) return byBase;
  }
  return DEFAULT_LOCALE;
}
