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

export const DEFAULT_LIMIT = 3;

/** Opaque paints, whose hex stands for how they look on the model. */
export const DEFAULT_PAINT_TYPES: readonly PaintType[] = Object.freeze([
  "base",
  "layer",
  "standard",
  "dry",
]);

export interface MatchOptions {
  /** Brands to search, in any order; the result follows catalog order. */
  readonly brandIds: readonly BrandId[] | "all";
  /** Paint types that are candidates. Default: `DEFAULT_PAINT_TYPES`. */
  readonly paintTypes?: readonly PaintType[];
  /** Whether metallic paints are candidates. Default: `false`. */
  readonly includeMetallic?: boolean;
  /** Maximum results per brand, a positive integer. Default: `DEFAULT_LIMIT`. */
  readonly limit?: number;
}

/** Not persisted (docs/01 §4). */
export interface CalculatedMatch {
  readonly paint: Paint;
  readonly brand: Brand;
  /** Unrounded; results are compared at 2 decimals. */
  readonly deltaE2000: number;
  readonly quality: MatchQuality;
  /** The wheel colour is exact, so only the paint's colour counts. */
  readonly approximate: boolean;
}

export interface BrandMatches {
  readonly brand: Brand;
  /** Empty if no paint of the brand passes the filters. */
  readonly matches: readonly CalculatedMatch[];
}

export interface ClosestPaints {
  /** The `limit` the search used; `rankOverall` never returns more. */
  readonly limit: number;
  readonly byBrand: readonly BrandMatches[];
}

export type MatchingError =
  | { readonly kind: "invalid-color"; readonly color: string }
  | { readonly kind: "invalid-limit"; readonly limit: number };

const HEX = /^#[0-9a-f]{6}$/i;

const deltaE2000 = differenceCiede2000();

/**
 * The `limit` closest candidates of each selected brand to `hex` (`#rrggbb`,
 * any case). Brands without candidates stay in the result with no matches.
 */
export function findClosestPaints(
  index: PaintIndex,
  hex: string,
  {
    brandIds,
    paintTypes = DEFAULT_PAINT_TYPES,
    includeMetallic = false,
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
    types.has(paint.type) && (includeMetallic || !paint.metallic);
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
 * All the matches of `closest` in one list, with the same order. Returns at
 * most `closest.limit`: past that position a brand could have a better paint
 * that the search did not return.
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

/** ΔE at 2 decimals, then paint ID: a total, engine-independent order. */
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
