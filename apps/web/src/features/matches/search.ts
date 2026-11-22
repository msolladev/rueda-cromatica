/**
 * What each color of the wheel shows (docs/07 §2): the search of `domain`
 * with the filters of the screen, and the official equivalences of the paint
 * chosen in the search (docs/07 §16), turned into plain data that the
 * components draw and the prerendering can embed in the page.
 */
import type { Role } from "@chromatic-wheel/color-wheel";
import {
  colorApproximationReasons,
  DEFAULT_PAINT_TYPES,
  findClosestPaints,
  findOfficialEquivalences,
  rankOverall,
  type ApproximationReason,
  type Brand,
  type Catalog,
  type ColorOrigin,
  type MatchQuality,
  type OfficialMatch,
  type Paint,
  type PaintId,
  type PaintIndex,
  type PaintType,
  type Source,
} from "@chromatic-wheel/domain";
import { OVERALL, type Filters } from "../../app/state.ts";
import { SEPARATOR } from "../../i18n/i18n.ts";

/** A document that states an official equivalence. */
export interface SourceView {
  readonly publisher: string;
  readonly title: string;
}

/** An official equivalence of a paint, as its «Details» list it. */
export interface EquivalenceLink {
  /** `outgoing`: the paint's manufacturer states it; `incoming`: another. */
  readonly direction: "outgoing" | "incoming";
  /** The other paint. */
  readonly id: string;
  readonly name: string;
  /** `null` if it has no colour, so it cannot be the base. */
  readonly hex: string | null;
  readonly brandName: string;
  readonly rangeName: string;
  readonly code: string | null;
  readonly sources: readonly SourceView[];
}

/**
 * A paint as the results show it. Its colour fields are `null` only for a
 * paint without colour, which only the official equivalences show.
 */
export interface PaintView {
  readonly id: string;
  readonly name: string;
  readonly hex: string | null;
  readonly code: string | null;
  readonly brandName: string;
  readonly rangeName: string;
  readonly type: PaintType;
  readonly metallic: boolean;
  readonly discontinued: boolean;
  readonly quality: MatchQuality | null;
  /** ΔE CIEDE2000 with the color of the wheel, unrounded. */
  readonly deltaE: number | null;
  /** Empty if the colour is exact. */
  readonly reasons: readonly ApproximationReason[];
  readonly origin: ColorOrigin | null;
  /** Who publishes the hex: the source's publisher. */
  readonly sourceName: string | null;
  /** The paint chosen in the search, first whatever its ΔE (docs/07 §15). */
  readonly chosen: boolean;
  /** Its official equivalences, outgoing first (docs/07 §2). */
  readonly official: readonly EquivalenceLink[];
}

/** A paint of the block of official equivalences, with who states it. */
export interface OfficialRow {
  readonly paint: PaintView;
  readonly sources: readonly SourceView[];
}

/** The official equivalences of the chosen paint (docs/07 §16). */
export interface OfficialResults {
  readonly name: string;
  readonly brandName: string;
  /** «Brand · Range · code», as the search shows a paint. */
  readonly label: string;
  readonly outgoing: readonly OfficialRow[];
  readonly incoming: readonly OfficialRow[];
}

export interface BrandResults {
  readonly brandId: string;
  readonly brandName: string;
  readonly paints: readonly PaintView[];
  /** Whether «See more» can show more paints of the brand. */
  readonly hasMore: boolean;
}

/** The results of one color of the wheel. */
export interface ColorResults {
  readonly role: Role;
  readonly hex: string;
  /** The selected brands, in catalog order. */
  readonly byBrand: readonly BrandResults[];
  /** The closest of all brands together. */
  readonly overall: readonly PaintView[];
  readonly overallHasMore: boolean;
  /** Only in the base's tab, with a paint chosen in the search. */
  readonly official: OfficialResults | null;
}

/** How many paints to show: per brand ID, and of all brands together. */
export type Limits = (key: string) => number;

/** «Brand · Range · code», as the search shows a paint (docs/07 §15). */
export const paintLabel = (paint: {
  readonly brandName: string;
  readonly rangeName: string;
  readonly code: string | null;
}): string =>
  [paint.brandName, paint.rangeName, paint.code]
    .filter((part) => part !== null && part !== "")
    .join(SEPARATOR);

const sourceView = (source: Source): SourceView => ({
  publisher: source.publisher,
  title: source.title,
});

/** What a paint, or another paint of its equivalences, shows. */
interface Measured {
  readonly paint: Paint;
  readonly brand: Brand;
  readonly deltaE2000: number | null;
  readonly quality: MatchQuality | null;
}

function paintView(
  catalog: Catalog,
  { paint, brand, deltaE2000, quality }: Measured,
  chosen = false,
): PaintView {
  const color = paint.color;
  // The colour of a paint is its own; its links only need the other paints.
  const found = findOfficialEquivalences(
    catalog,
    paint.id,
    color?.hex ?? "#000000",
  );
  if (!found.ok) throw new Error(`Search failed: ${found.error.kind}`);
  const link =
    (direction: EquivalenceLink["direction"]) =>
    (match: OfficialMatch): EquivalenceLink => ({
      direction,
      id: match.paint.id,
      name: match.paint.name,
      hex: match.paint.color?.hex ?? null,
      brandName: match.brand.name,
      rangeName: catalog.range(match.paint.rangeId)?.name ?? "",
      code: match.paint.manufacturerCode,
      sources: match.sources.map(sourceView),
    });
  return {
    id: paint.id,
    name: paint.name,
    hex: color?.hex ?? null,
    code: paint.manufacturerCode,
    brandName: brand.name,
    rangeName: catalog.range(paint.rangeId)?.name ?? "",
    type: paint.type,
    metallic: paint.metallic,
    discontinued: paint.status.kind === "discontinued",
    quality,
    deltaE: deltaE2000,
    reasons: colorApproximationReasons(paint),
    origin: color?.origin ?? null,
    sourceName:
      color === null ? null : (catalog.source(color.sourceId)?.publisher ?? ""),
    chosen,
    official: [
      ...found.value.outgoing.map(link("outgoing")),
      ...found.value.incoming.map(link("incoming")),
    ],
  };
}

/** The official equivalences of a paint, measured against the wheel's color. */
function officialResults(
  catalog: Catalog,
  paintId: PaintId,
  hex: string,
): OfficialResults | null {
  const paint = catalog.paint(paintId);
  if (paint === undefined) return null;
  const found = findOfficialEquivalences(catalog, paintId, hex);
  if (!found.ok) throw new Error(`Search failed: ${found.error.kind}`);
  const row = (match: OfficialMatch): OfficialRow => ({
    paint: paintView(catalog, match),
    sources: match.sources.map(sourceView),
  });
  const brandName = catalog.brandOf(paint).name;
  return {
    name: paint.name,
    brandName,
    label: paintLabel({
      brandName,
      rangeName: catalog.range(paint.rangeId)?.name ?? "",
      code: paint.manufacturerCode,
    }),
    outgoing: found.value.outgoing.map(row),
    incoming: found.value.incoming.map(row),
  };
}

/**
 * The results for one color of the wheel. Each limit asks for one more paint
 * than it shows, to know whether «See more» can show more.
 */
export function searchColor(
  catalog: Catalog,
  index: PaintIndex,
  color: { readonly role: Role; readonly hex: string },
  filters: Filters,
  limits: Limits,
  /** The paint chosen in the search, shown first among the base's paints. */
  chosenPaintId?: PaintId,
): ColorResults {
  const brands = catalog
    .brands()
    .filter((brand) => !filters.excludedBrands.includes(brand.id));
  const limit =
    Math.max(limits(OVERALL), ...brands.map((brand) => limits(brand.id))) + 1;
  const found = findClosestPaints(index, color.hex, {
    brandIds: brands.map((brand) => brand.id),
    paintTypes: [...DEFAULT_PAINT_TYPES, ...filters.extraTypes],
    includeMetallic: filters.includeMetallic,
    includeDiscontinued: filters.includeDiscontinued,
    limit,
    pinnedPaintId: chosenPaintId,
  });
  // The wheel only gives `#rrggbb` and the limits are positive integers.
  if (!found.ok) throw new Error(`Search failed: ${found.error.kind}`);

  const byBrand = found.value.byBrand.map(({ brand, matches }) => {
    const shown = limits(brand.id);
    return {
      brandId: brand.id,
      brandName: brand.name,
      paints: matches
        .slice(0, shown)
        .map((m) => paintView(catalog, m, m.pinned)),
      hasMore: matches.length > shown,
    };
  });
  const overall = rankOverall(found.value);
  const shownOverall = limits(OVERALL);
  return {
    role: color.role,
    hex: color.hex,
    byBrand,
    overall: overall
      .slice(0, shownOverall)
      .map((m) => paintView(catalog, m, m.pinned)),
    overallHasMore: overall.length > shownOverall,
    official:
      chosenPaintId === undefined
        ? null
        : officialResults(catalog, chosenPaintId, color.hex),
  };
}
