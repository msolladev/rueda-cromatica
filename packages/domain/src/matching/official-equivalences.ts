/**
 * Official equivalences seen from one paint (docs/06 §10, ADR-0033): what its
 * manufacturer says it is in other brands, and what other manufacturers say
 * is it. Each one with how far it is from a colour, as the closest paints, so
 * that the interface shows both with the same row without mixing them.
 */
import { differenceCiede2000 } from "culori/fn";
import type { Catalog } from "../catalog/catalog.ts";
import { isColorApproximate } from "../catalog/rules.ts";
import {
  toHexColor,
  type Brand,
  type OfficialEquivalence,
  type Paint,
  type PaintId,
  type Source,
} from "../catalog/schema.ts";
import { err, ok, type Result } from "../result.ts";
import type { MatchingError } from "./closest-paints.ts";
import { labOf } from "./paint-index.ts";
import { matchQuality, type MatchQuality } from "./quality.ts";

const deltaE2000 = differenceCiede2000();

/** The other paint of one or more edges, with what states them. */
export interface OfficialMatch {
  /** The other paint: the destination of an outgoing edge, the origin of an incoming one. */
  readonly paint: Paint;
  /** Its brand. */
  readonly brand: Brand;
  /**
   * The documents that state the edge, in catalog order: one at least, more
   * if several manufacturer documents say the same.
   */
  readonly sources: readonly Source[];
  /**
   * ΔE CIEDE2000 between the colour and the paint, unrounded; `null` if the
   * paint has no colour.
   */
  readonly deltaE2000: number | null;
  /** The label of `deltaE2000`, or `null` if the paint has no colour. */
  readonly quality: MatchQuality | null;
  /** Whether the paint's hex is approximate ({@link isColorApproximate}). */
  readonly approximate: boolean;
}

/** The result of {@link findOfficialEquivalences}. */
export interface OfficialEquivalences {
  /**
   * What the paint's manufacturer says it is in other ranges: the edges whose
   * origin is the paint, by destination in catalog order.
   */
  readonly outgoing: readonly OfficialMatch[];
  /**
   * What other documents say is the paint: the edges whose destination is the
   * paint, by origin in catalog order.
   */
  readonly incoming: readonly OfficialMatch[];
}

/**
 * The official equivalences of a paint, in both directions and never
 * inferred: an edge is only read in its direction (ADR-0004). The result is
 * frozen.
 *
 * @param catalog - The catalog.
 * @param paintId - The paint, such as the one chosen in the paint search.
 * @param hex - The colour to measure each paint against, as `#rrggbb` in any
 *   case: the wheel's colour, the top half of each swatch.
 * @returns Both lists, empty if the paint has no official equivalences, or a
 *   {@link MatchingError} if `hex` is not `#rrggbb`.
 * @throws Error if the paint is not in the catalog: a programming error.
 *
 * @example
 * ```ts
 * const found = findOfficialEquivalences(catalog, paint.id, "#000000");
 * if (found.ok) {
 *   for (const match of found.value.outgoing) {
 *     console.log(match.paint.name, match.sources[0]?.publisher);
 *   }
 * }
 * ```
 */
export function findOfficialEquivalences(
  catalog: Catalog,
  paintId: PaintId,
  hex: string,
): Result<OfficialEquivalences, MatchingError> {
  if (catalog.paint(paintId) === undefined) {
    throw new Error(`Paint ${paintId} is not in the catalog`);
  }
  const color = toHexColor(hex);
  if (color === null) return err({ kind: "invalid-color", color: hex });
  const target = labOf(color);

  const matches = (
    edges: readonly OfficialEquivalence[],
    other: (edge: OfficialEquivalence) => PaintId,
  ): readonly OfficialMatch[] => {
    // Edges come sorted by (from, to, sourceId): those of the same pair of
    // paints are together.
    const grouped = new Map<PaintId, Source[]>();
    for (const edge of edges) {
      const source = catalog.source(edge.sourceId);
      if (source === undefined) throw new Error(`No source ${edge.sourceId}`);
      const sources = grouped.get(other(edge)) ?? [];
      sources.push(source);
      grouped.set(other(edge), sources);
    }
    return Object.freeze(
      [...grouped].map(([id, sources]) => {
        const paint = catalog.paint(id);
        if (paint === undefined) throw new Error(`No paint ${id}`);
        const deltaE =
          paint.color === null
            ? null
            : deltaE2000(target, labOf(paint.color.hex));
        return Object.freeze({
          paint,
          brand: catalog.brandOf(paint),
          sources: Object.freeze(sources),
          deltaE2000: deltaE,
          quality: deltaE === null ? null : matchQuality(deltaE),
          approximate: isColorApproximate(paint),
        });
      }),
    );
  };

  return ok(
    Object.freeze({
      outgoing: matches(catalog.officialEquivalencesFrom(paintId), (e) => e.to),
      incoming: matches(catalog.officialEquivalencesTo(paintId), (e) => e.from),
    }),
  );
}
