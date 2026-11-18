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
  /** `/es/credits/`: data sources and third-party licenses. */
  | { readonly kind: "credits"; readonly locale: Locale };

const CREDITS = "credits";

/** The path of a page, always ending in `/`. */
export function pathOf(page: Page): string {
  switch (page.kind) {
    case "languages":
      return "/";
    case "home":
      return `/${localeSlug(page.locale)}/`;
    case "credits":
      return `/${localeSlug(page.locale)}/${CREDITS}/`;
  }
}

/** The page of a path, with or without the final `/`, or `undefined`. */
export function pageOf(pathname: string): Page | undefined {
  const parts = pathname.split("/").filter((part) => part !== "");
  if (parts.length === 0) return { kind: "languages" };
  const locale = localeOfSlug(parts[0] ?? "");
  if (locale === undefined || parts.length > 2) return undefined;
  if (parts.length === 1) return { kind: "home", locale };
  return parts[1] === CREDITS ? { kind: "credits", locale } : undefined;
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

/** The same page in another locale; the one for `/` has no locale. */
export function withLocale(page: Page, locale: Locale): Page {
  return page.kind === "languages"
    ? { kind: "home", locale }
    : { ...page, locale };
}
