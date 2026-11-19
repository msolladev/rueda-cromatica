/**
 * What the prerendering computes for each page and embeds in it, so that the
 * browser renders the same HTML when it takes over (docs/07 §10).
 */
import type { CreditsData } from "../features/credits/data.ts";
import type { Locale } from "../i18n/i18n.ts";
import type { BrandOption } from "../features/matches/Filters.tsx";
import type { ColorResults } from "../features/matches/search.ts";

export interface HomeData {
  readonly brands: readonly BrandOption[];
  /**
   * The results of the wheel's starting color with the default filters: the
   * content without JavaScript, and what is shown until the catalog loads.
   */
  readonly example: readonly ColorResults[];
}

export type PageData =
  | { readonly kind: "languages" }
  | { readonly kind: "home"; readonly home: HomeData }
  | { readonly kind: "credits"; readonly credits: CreditsData }
  /**
   * «Page not found» says its language: its address is any unknown one, so
   * the browser cannot read it from there.
   */
  | { readonly kind: "not-found"; readonly locale: Locale };

/** The id of the `<script type="application/json">` with the page's data. */
export const PAGE_DATA_ID = "page-data";
