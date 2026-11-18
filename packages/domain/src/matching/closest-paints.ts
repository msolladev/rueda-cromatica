/**
 * Calculated equivalences (docs/06 §4-6): the paints closest to a colour by
 * ΔE CIEDE2000, per brand, and the same results ranked across brands.
 */
import { differenceCiede2000 } from "culori/fn";
import { isColorApproximate } from "../catalog/rules.ts";
import type { Brand, BrandId, Paint, PaintType } from "../catalog/schema.ts";
import { err, ok, type Result } from "../result.ts";
import { labOf, type IndexedPaint, type PaintIndex } from "./paint-index.ts";
import { matchQuality, roundDeltaE, type MatchQuality } from "./quality.ts";

/** Results per brand when {@link MatchOptions.limit} is not given. */
export const DEFAULT_LIMIT = 3;

/**
 * Paint types that are candidates when {@link MatchOptions.paintTypes} is not
 * given: the opaque ones, whose hex stands for how they look on the model.
 */
export const DEFAULT_PAINT_TYPES: readonly PaintType[] = Object.freeze([
  "base",
  "layer",
  "standard",
  "dry",
]);

/** What {@link findClosestPaints} searches. Only `brandIds` is required. */
export interface MatchOptions {
  /**
   * Brands to search, in any order and with repetitions, or `"all"`. The
   * result follows catalog order. An ID that is not in the catalog is
   * ignored.
   */
  readonly brandIds: readonly BrandId[] | "all";
  /**
   * Paint types that are candidates. Contrast, washes, inks, glazes and
   * technical paints are added on request.
   *
   * @defaultValue {@link DEFAULT_PAINT_TYPES}
   */
  readonly paintTypes?: readonly PaintType[];
  /**
   * Whether metallic paints are candidates.
   *
   * @defaultValue `false`
   */
  readonly includeMetallic?: boolean;
  /**
   * Whether discontinued paints are candidates. They can no longer be bought,
   * but whoever has them can ask for them.
   *
   * @defaultValue `false`
   */
  readonly includeDiscontinued?: boolean;
  /**
   * Maximum results per brand, a positive integer.
   *
   * @defaultValue {@link DEFAULT_LIMIT}
   */
  readonly limit?: number;
}

/** A paint close to the searched colour: a calculated equivalence, never stored. */
export interface CalculatedMatch {
  /** The paint. */
  readonly paint: Paint;
  /** Its brand. */
  readonly brand: Brand;
  /**
   * ΔE CIEDE2000 between the colour and the paint, unrounded. Results are
   * compared and labelled at 2 decimals.
   */
  readonly deltaE2000: number;
  /** The label of `deltaE2000`, as {@link matchQuality} gives it. */
  readonly quality: MatchQuality;
  /**
   * Whether the paint's hex is approximate ({@link isColorApproximate}). The
   * wheel colour is exact, so only the paint's colour counts. It does not
   * change the order; the interface warns about it.
   */
  readonly approximate: boolean;
}

/** The results of one brand. */
export interface BrandMatches {
  /** The brand. */
  readonly brand: Brand;
  /**
   * Its closest candidates, in the order of {@link compareMatches}. Empty if no
   * paint of the brand passes the filters, so that the interface can say so.
   */
  readonly matches: readonly CalculatedMatch[];
}

/** The result of {@link findClosestPaints}. */
export interface ClosestPaints {
  /** The `limit` the search used; {@link rankOverall} never returns more. */
  readonly limit: number;
  /** Every selected brand, in catalog order, also those without results. */
  readonly byBrand: readonly BrandMatches[];
}

/** Why {@link findClosestPaints} could not search. */
export type MatchingError =
  | {
      /** The colour is not `#rrggbb`. */
      readonly kind: "invalid-color";
      /** The colour received. */
      readonly color: string;
    }
  | {
      /** The limit is not a positive integer. */
      readonly kind: "invalid-limit";
      /** The limit received. */
      readonly limit: number;
    };

const HEX = /^#[0-9a-f]{6}$/i;

const deltaE2000 = differenceCiede2000();

/**
 * Finds the paints closest to a colour, by ΔE CIEDE2000: the `limit` closest
 * candidates of each selected brand. There is no maximum ΔE, so there is
 * always an answer if a brand has candidates. The result is frozen.
 *
 * @param index - The index of the catalog, from {@link buildPaintIndex}.
 * @param hex - The colour, as `#rrggbb` in any case, such as those of the
 *   wheel.
 * @param options - Which brands and paints to search, and how many.
 * @returns The results, or a {@link MatchingError} if `hex` is not
 *   `#rrggbb` or `limit` is not a positive integer (0, negative, decimal,
 *   `NaN` or `Infinity`).
 *
 * @example
 * ```ts
 * const index = buildPaintIndex(catalog);
 * const found = findClosestPaints(index, "#3daf44", { brandIds: ["citadel"] });
 * if (found.ok) {
 *   for (const match of found.value.byBrand[0]?.matches ?? []) {
 *     console.log(match.paint.name, match.deltaE2000);
 *   }
 * }
 * ```
 */
export function findClosestPaints(
  index: PaintIndex,
  hex: string,
  {
    brandIds,
    paintTypes = DEFAULT_PAINT_TYPES,
    includeMetallic = false,
    includeDiscontinued = false,
    limit = DEFAULT_LIMIT,
  }: MatchOptions,
): Result<ClosestPaints, MatchingError> {
  if (!HEX.test(hex)) return err({ kind: "invalid-color", color: hex });
  if (!Number.isInteger(limit) || limit < 1) {
    return err({ kind: "invalid-limit", limit });
  }

  const target = labOf(hex.toLowerCase());
  const types = new Set(paintTypes);
  const isCandidate = ({ paint }: IndexedPaint): boolean =>
    types.has(paint.type) &&
    (includeMetallic || !paint.metallic) &&
    (includeDiscontinued || paint.status.kind === "active");
  const wanted = brandIds === "all" ? null : new Set(brandIds);

  const byBrand = index.brands
    .filter(({ brand }) => wanted === null || wanted.has(brand.id))
    .map(({ brand, paints }): BrandMatches =>
      Object.freeze({
        brand,
        matches: Object.freeze(
          paints
            .filter(isCandidate)
            .map((entry) => scored(entry, deltaE2000(target, entry.lab)))
            .sort(compareScored)
            .slice(0, limit)
            .map(toMatch),
        ),
      }),
    );

  return ok(Object.freeze({ limit, byBrand: Object.freeze(byBrand) }));
}

/**
 * Joins the results of every brand in one list, in the order of
 * {@link compareMatches}, without computing any ΔE again. The result is
 * frozen.
 *
 * It returns at most `closest.limit` results: past that position the order
 * would not be reliable, because a brand could have a better paint that the
 * search did not return. To get the N closest of every brand, search with a
 * `limit` of N or more.
 */
export function rankOverall(
  closest: ClosestPaints,
): readonly CalculatedMatch[] {
  return Object.freeze(
    closest.byBrand
      .flatMap(({ matches }) => matches)
      .sort(compareMatches)
      .slice(0, closest.limit),
  );
}

/**
 * The order of the results: the ΔE rounded to 2 decimals, from lower to
 * higher, then the paint ID, by code unit and without locale. It is a total
 * order, the same in every JavaScript engine. For `Array.prototype.sort`.
 */
export function compareMatches(a: CalculatedMatch, b: CalculatedMatch): number {
  return compareBy(
    roundDeltaE(a.deltaE2000),
    a.paint.id,
    roundDeltaE(b.deltaE2000),
    b.paint.id,
  );
}

// The search scores every candidate but builds matches only for the ones it
// returns, and rounds each ΔE once instead of in every comparison.
interface Scored {
  readonly entry: IndexedPaint;
  readonly deltaE: number;
  readonly rounded: number;
}

const scored = (entry: IndexedPaint, deltaE: number): Scored => ({
  entry,
  deltaE,
  rounded: roundDeltaE(deltaE),
});

const compareScored = (a: Scored, b: Scored): number =>
  compareBy(a.rounded, a.entry.paint.id, b.rounded, b.entry.paint.id);

// IDs by code unit, as docs/02 sorts them (`compareSortKeys` with one key).
function compareBy(
  deltaA: number,
  idA: string,
  deltaB: number,
  idB: string,
): number {
  if (deltaA !== deltaB) return deltaA - deltaB;
  if (idA === idB) return 0;
  return idA < idB ? -1 : 1;
}

function toMatch({ entry: { paint, brand }, deltaE }: Scored): CalculatedMatch {
  return Object.freeze({
    paint,
    brand,
    deltaE2000: deltaE,
    quality: matchQuality(deltaE),
    approximate: isColorApproximate(paint),
  });
}
