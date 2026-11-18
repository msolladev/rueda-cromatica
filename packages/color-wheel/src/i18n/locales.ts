import { describeValue, oneOf } from "../errors.ts";

/**
 * The included locales. Each one has every text of {@link Labels}.
 */
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

/** One of the {@link LOCALES}. */
export type Locale = (typeof LOCALES)[number];

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
 * The default locale (docs/05 §6.5): the first of `preferred` that matches an
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
