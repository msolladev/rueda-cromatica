/**
 * What each color of the wheel shows (docs/07 §2): the search of `domain`
 * with the filters of the screen, and the official equivalences and the
 * replacement of the paint chosen in the search (docs/07 §16), turned into
 * plain data that the components draw and the prerendering can embed in the
 * page.
 */
import type { Role } from "@chromatic-wheel/color-wheel";
import {
  colorApproximationReasons,
  colorStandIn,
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

/** An official equivalence or the replacement of a paint, as its «Details» list it. */
export interface EquivalenceLink {
  /**
   * `replacement`: the paint that replaces it (ADR-0005); `outgoing`: the
   * paint's manufacturer states it; `incoming`: another.
   */
  readonly direction: "replacement" | "outgoing" | "incoming";
  /** The other paint. */
  readonly id: string;
  readonly name: string;
  /** `null` if it has no colour. */
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
  /** Its replacement and its official equivalences, in that order (docs/07 §2). */
  readonly official: readonly EquivalenceLink[];
}

/** A paint of the block of official equivalences, with who states it. */
export interface OfficialRow {
  readonly paint: PaintView;
  readonly sources: readonly SourceView[];
}

/**
 * The paint whose colour the wheel takes for a chosen paint without colour
 * (docs/07 §15), with the document that relates them.
 */
export interface StandInView {
  readonly name: string;
  readonly via: "replacement" | "equivalence";
  readonly publisher: string;
}

/** The official equivalences and the replacement of the chosen paint (docs/07 §16). */
export interface OfficialResults {
  readonly name: string;
  readonly brandName: string;
  /** «Brand · Range · code», as the search shows a paint. */
  readonly label: string;
  /** Whether it is discontinued: then the block has the replacement group. */
  readonly discontinued: boolean;
  /**
   * Whether it has no colour: its rows are not measured against the wheel,
   * whose colour is not the paint's.
   */
  readonly colorless: boolean;
  /** For a paint without colour, the one whose colour the wheel takes. */
  readonly standIn: StandInView | null;
  readonly replacement: OfficialRow | null;
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
  // Its links only need the other paints, not how far they are.
  const found = findOfficialEquivalences(catalog, paint.id, null);
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
      ...(found.value.replacement === null
        ? []
        : [link("replacement")(found.value.replacement)]),
      ...found.value.outgoing.map(link("outgoing")),
      ...found.value.incoming.map(link("incoming")),
    ],
  };
}

/**
 * The paint whose colour the wheel takes for a paint without colour, with the
 * document that relates them: the first link of the replacement chain, or the
 * equivalence (docs/07 §15). `null` if there is nothing to take.
 */
export function standInView(
  catalog: Catalog,
  paintId: PaintId,
): StandInView | null {
  const standIn = colorStandIn(catalog, paintId);
  if (standIn === null) return null;
  const found = findOfficialEquivalences(catalog, paintId, null);
  if (!found.ok) throw new Error(`Search failed: ${found.error.kind}`);
  const { replacement, outgoing, incoming } = found.value;
  const related =
    standIn.via === "replacement"
      ? replacement
      : [...outgoing, ...incoming].find(
          (match) => match.paint.id === standIn.paint.id,
        );
  return {
    name: standIn.paint.name,
    via: standIn.via,
    publisher: related?.sources[0]?.publisher ?? "",
  };
}

/**
 * The official equivalences and the replacement of a paint, measured against
 * the wheel's color if the paint has a colour of its own.
 */
function officialResults(
  catalog: Catalog,
  paintId: PaintId,
  hex: string,
): OfficialResults | null {
  const paint = catalog.paint(paintId);
  if (paint === undefined) return null;
  const colorless = paint.color === null;
  const found = findOfficialEquivalences(
    catalog,
    paintId,
    colorless ? null : hex,
  );
  if (!found.ok) throw new Error(`Search failed: ${found.error.kind}`);
  const row = (match: OfficialMatch): OfficialRow => ({
    paint: paintView(catalog, match),
    sources: match.sources.map(sourceView),
  });
  const brandName = catalog.brandOf(paint).name;
  const { replacement, outgoing, incoming } = found.value;
  return {
    name: paint.name,
    brandName,
    label: paintLabel({
      brandName,
      rangeName: catalog.range(paint.rangeId)?.name ?? "",
      code: paint.manufacturerCode,
    }),
    discontinued: paint.status.kind === "discontinued",
    colorless,
    standIn: standInView(catalog, paintId),
    replacement: replacement === null ? null : row(replacement),
    outgoing: outgoing.map(row),
    incoming: incoming.map(row),
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
    // A paint without colour cannot be among the closest.
    pinnedPaintId:
      chosenPaintId === undefined ||
      (catalog.paint(chosenPaintId)?.color ?? null) === null
        ? undefined
        : chosenPaintId,
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
