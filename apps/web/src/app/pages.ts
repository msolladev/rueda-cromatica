/**
 * The pages of the web and their URLs (docs/07 §12). Each page is prerendered
 * as its own HTML, and links between them are normal links.
 */
import {
  LOCALES,
  localeOfSlug,
  localeSlug,
  type Locale,
} from "../i18n/i18n.ts";

export type Page =
  /** `/`: picks the saved or detected language, with links to all. */
  | { readonly kind: "languages" }
  /** `/es/`: the wheel and the closest paints. */
  | { readonly kind: "home"; readonly locale: Locale }
  /** `/es/creditos/`: data sources and third-party licenses. */
  | { readonly kind: "credits"; readonly locale: Locale }
  /** Any other address: «Page not found», with the HTTP status 404. */
  | { readonly kind: "not-found"; readonly locale: Locale };

/**
 * The name of the credits page in its URL, in the language of the page
 * (docs/07 §12): the URL also says what the page is, for search engines and
 * for whoever reads the link. The languages with another alphabet keep the
 * English name: a path does not mix two alphabets.
 */
export const CREDITS_SLUGS: Readonly<Record<Locale, string>> = {
  en: "credits",
  es: "creditos",
  ca: "credits",
  eu: "kredituak",
  gl: "creditos",
  fr: "credits",
  de: "danksagungen",
  it: "crediti",
  "pt-BR": "creditos",
  ru: "credits",
  "zh-Hans": "credits",
  ja: "credits",
  ko: "credits",
};

/**
 * The path of a page, always ending in `/`. «Page not found» has no address
 * of its own: it answers at any unknown one, so its path is its language's
 * home.
 */
export function pathOf(page: Page): string {
  switch (page.kind) {
    case "not-found":
      return `/${localeSlug(page.locale)}/`;
    case "languages":
      return "/";
    case "home":
      return `/${localeSlug(page.locale)}/`;
    case "credits":
      return `/${localeSlug(page.locale)}/${CREDITS_SLUGS[page.locale]}/`;
  }
}

/** The page of a path, with or without the final `/`, or `undefined`. */
export function pageOf(pathname: string): Page | undefined {
  const parts = pathname.split("/").filter((part) => part !== "");
  if (parts.length === 0) return { kind: "languages" };
  const locale = localeOfSlug(parts[0] ?? "");
  if (locale === undefined || parts.length > 2) return undefined;
  if (parts.length === 1) return { kind: "home", locale };
  return parts[1] === CREDITS_SLUGS[locale]
    ? { kind: "credits", locale }
    : undefined;
}

/** Every page, in a fixed order: the one for `/` and, per locale, home and credits. */
export function allPages(): readonly Page[] {
  return [
    { kind: "languages" },
    ...LOCALES.flatMap((locale): Page[] => [
      { kind: "home", locale },
      { kind: "credits", locale },
    ]),
  ];
}

/**
 * The same page in another locale. The one for `/` has no locale, and «Page
 * not found» has no address: both go to the home of that locale.
 */
export function withLocale(page: Page, locale: Locale): Page {
  return page.kind === "languages" || page.kind === "not-found"
    ? { kind: "home", locale }
    : { ...page, locale };
}

/**
 * «Page not found» for an unknown address: in the language of its first
 * segment if it is one (`/es/whatever/`), and in English otherwise.
 */
export function notFoundAt(pathname: string): Page {
  const first = pathname.split("/").find((part) => part !== "") ?? "";
  return { kind: "not-found", locale: localeOfSlug(first) ?? "en" };
}

/**
 * The files of «Page not found» (docs/07 §12): one per language,
 * `/<locale>/404.html`, and `/404.html` in English for the addresses without
 * a language. The server answers with them, and the status 404, at any
 * unknown address.
 */
export function notFoundFiles(): readonly {
  readonly file: string;
  readonly page: Page;
}[] {
  return [
    { file: "/404.html", page: { kind: "not-found", locale: "en" } },
    ...LOCALES.map((locale) => ({
      file: `/${localeSlug(locale)}/404.html`,
      page: { kind: "not-found", locale } as const,
    })),
  ];
}
