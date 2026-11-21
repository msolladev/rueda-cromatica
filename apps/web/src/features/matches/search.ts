/**
 * What each color of the wheel shows (docs/07 §2): the search of `domain`
 * with the filters of the screen, turned into plain data that the components
 * draw and the prerendering can embed in the page.
 */
import type { Role } from "@chromatic-wheel/color-wheel";
import {
  colorApproximationReasons,
  DEFAULT_PAINT_TYPES,
  findClosestPaints,
  rankOverall,
  type ApproximationReason,
  type CalculatedMatch,
  type Catalog,
  type ColorOrigin,
  type MatchQuality,
  type PaintId,
  type PaintIndex,
  type PaintType,
} from "@chromatic-wheel/domain";
import { OVERALL, type Filters } from "../../app/state.ts";

/** A paint as the results show it. */
export interface PaintView {
  readonly id: string;
  readonly name: string;
  readonly hex: string;
  readonly code: string | null;
  readonly brandName: string;
  readonly rangeName: string;
  readonly type: PaintType;
  readonly metallic: boolean;
  readonly discontinued: boolean;
  readonly quality: MatchQuality;
  /** ΔE CIEDE2000, unrounded. */
  readonly deltaE: number;
  /** Empty if the colour is exact. */
  readonly reasons: readonly ApproximationReason[];
  readonly origin: ColorOrigin;
  /** Who publishes the hex: the source's publisher. */
  readonly sourceName: string;
  /** The paint chosen in the search, first whatever its ΔE (docs/07 §15). */
  readonly chosen: boolean;
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
}

/** How many paints to show: per brand ID, and of all brands together. */
export type Limits = (key: string) => number;

function paintView(catalog: Catalog, match: CalculatedMatch): PaintView {
  const { paint, brand } = match;
  // Candidates always have a colour (docs/06 §5).
  const color = paint.color;
  if (color === null) throw new Error(`Paint without colour: ${paint.id}`);
  return {
    id: paint.id,
    name: paint.name,
    hex: color.hex,
    code: paint.manufacturerCode,
    brandName: brand.name,
    rangeName: catalog.range(paint.rangeId)?.name ?? "",
    type: paint.type,
    metallic: paint.metallic,
    discontinued: paint.status.kind === "discontinued",
    quality: match.quality,
    deltaE: match.deltaE2000,
    reasons: colorApproximationReasons(paint),
    origin: color.origin,
    sourceName: catalog.source(color.sourceId)?.publisher ?? "",
    chosen: match.pinned,
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
      paints: matches.slice(0, shown).map((m) => paintView(catalog, m)),
      hasMore: matches.length > shown,
    };
  });
  const overall = rankOverall(found.value);
  const shownOverall = limits(OVERALL);
  return {
    role: color.role,
    hex: color.hex,
    byBrand,
    overall: overall.slice(0, shownOverall).map((m) => paintView(catalog, m)),
    overallHasMore: overall.length > shownOverall,
  };
}
