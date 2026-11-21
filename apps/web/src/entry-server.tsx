/**
 * The prerendering (docs/07 §10): renders each page to HTML in Node, with the
 * data it embeds. The build runs it once per page; in development, Vite runs
 * it on each request.
 */
import { compute } from "@chromatic-wheel/color-wheel";
import {
  buildPaintIndex,
  DEFAULT_LIMIT,
  parseCatalog,
} from "@chromatic-wheel/domain";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { App } from "./app/App.tsx";
import { headOf, langOf } from "./app/head.ts";
import { allManifests } from "./app/manifest.ts";
import type { PageData } from "./app/page-data.ts";
import {
  allPages,
  notFoundAt,
  notFoundFiles,
  pathOf,
  type Page,
} from "./app/pages.ts";
import { DEFAULT_PREFERENCES } from "./app/state.ts";
import { sourceViews, type LicenseEntry } from "./features/credits/data.ts";
import { searchColor } from "./features/matches/search.ts";
import { DEFAULT_COLOR, DEFAULT_HARMONY } from "./features/wheel/defaults.ts";

export { allManifests, allPages, notFoundAt, notFoundFiles, pathOf, type Page };
export type { LicenseEntry };

export interface PrerenderInput {
  /** The parsed `catalog.json`. */
  readonly catalog: unknown;
  /** The third-party licenses of the distributed code. */
  readonly licenses: readonly LicenseEntry[];
  /** The site's origin, without a final `/`. */
  readonly origin: string;
}

export interface RenderedPage {
  readonly lang: string;
  readonly head: string;
  readonly html: string;
  readonly data: PageData;
}

/** Validates the catalog once and returns the renderer of the pages. */
export function createRenderer(
  input: PrerenderInput,
): (page: Page) => RenderedPage {
  const parsed = parseCatalog(input.catalog);
  if (!parsed.ok) {
    throw new Error(
      `catalog.json is not valid: ${JSON.stringify(parsed.error)}`,
    );
  }
  const catalog = parsed.value;
  const index = buildPaintIndex(catalog);
  const home = {
    brands: catalog
      .brands()
      .map((brand) => ({ id: brand.id, name: brand.name })),
    example: compute({
      color: DEFAULT_COLOR,
      harmony: DEFAULT_HARMONY,
    }).colors.map((color) =>
      searchColor(
        catalog,
        index,
        color,
        DEFAULT_PREFERENCES.filters,
        () => DEFAULT_LIMIT,
      ),
    ),
  };
  const credits = { sources: sourceViews(catalog), licenses: input.licenses };

  return (page) => {
    const data: PageData =
      page.kind === "home"
        ? { kind: "home", home }
        : page.kind === "credits"
          ? { kind: "credits", credits }
          : page.kind === "not-found"
            ? { kind: "not-found", locale: page.locale }
            : { kind: "languages" };
    const html = renderToString(
      <StrictMode>
        <App page={page} data={data} />
      </StrictMode>,
    );
    return { lang: langOf(page), head: headOf(page, input.origin), html, data };
  };
}
