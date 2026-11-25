/**
 * Official equivalences seen from one paint (docs/06 §10, ADR-0033): what its
 * manufacturer says it is in other brands, and what other manufacturers say
 * is it, with the replacement of a discontinued paint (ADR-0005). Each one
 * with how far it is from a colour, as the closest paints, so that the
 * interface shows both with the same row without mixing them.
 */
import { differenceCiede2000 } from "culori/fn";
import type { Catalog } from "../catalog/catalog.ts";
import { isColorApproximate, resolveReplacement } from "../catalog/rules.ts";
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
   * paint or the colour is missing.
   */
  readonly deltaE2000: number | null;
  /** The label of `deltaE2000`, or `null` if it is `null`. */
  readonly quality: MatchQuality | null;
  /** Whether the paint's hex is approximate ({@link isColorApproximate}). */
  readonly approximate: boolean;
}

/** The result of {@link findOfficialEquivalences}. */
export interface OfficialEquivalences {
  /**
   * The paint that replaces a discontinued paint, according to its
   * manufacturer (ADR-0005), with that document; `null` if it has none.
   */
  readonly replacement: OfficialMatch | null;
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
 *   case: the wheel's colour, the top half of each swatch. `null` when there
 *   is none to measure against, such as a chosen paint without colour: then
 *   no paint has a ΔE.
 * @returns The replacement and both lists, empty if the paint has no official
 *   equivalences, or a {@link MatchingError} if `hex` is not `#rrggbb`.
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
  hex: string | null,
): Result<OfficialEquivalences, MatchingError> {
  const chosen = catalog.paint(paintId);
  if (chosen === undefined) {
    throw new Error(`Paint ${paintId} is not in the catalog`);
  }
  const color = hex === null ? null : toHexColor(hex);
  if (hex !== null && color === null) {
    return err({ kind: "invalid-color", color: hex });
  }
  const target = color === null ? null : labOf(color);

  const match = (paint: Paint, sources: readonly Source[]): OfficialMatch => {
    const deltaE =
      paint.color === null || target === null
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
  };

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
        return match(paint, sources);
      }),
    );
  };

  const { status } = chosen;
  let replacement: OfficialMatch | null = null;
  if (status.kind === "discontinued" && status.replacement !== null) {
    const paint = catalog.paint(status.replacement.paintId);
    const source = catalog.source(status.replacement.sourceId);
    if (paint === undefined || source === undefined) {
      throw new Error(`Broken replacement of ${paintId}`);
    }
    replacement = match(paint, [source]);
  }

  return ok(
    Object.freeze({
      replacement,
      outgoing: matches(catalog.officialEquivalencesFrom(paintId), (e) => e.to),
      incoming: matches(catalog.officialEquivalencesTo(paintId), (e) => e.from),
    }),
  );
}

/**
 * The paint whose colour stands in for a paint without colour, when there is
 * nothing to choose (docs/07 §15): the end of its replacement chain, or else
 * its only officially equivalent paint, in either direction. `null` if it has
 * a colour, or if there is none or more than one candidate, and also if the
 * candidate has no colour either.
 *
 * @param catalog - The catalog.
 * @param paintId - The paint chosen in the paint search.
 * @returns The stand-in and why it was taken, or `null`.
 * @throws Error if the paint is not in the catalog: a programming error.
 *
 * @example
 * ```ts
 * const standIn = colorStandIn(catalog, paint.id);
 * if (standIn !== null) wheel.setBase(standIn.paint.color.hex);
 * ```
 */
export function colorStandIn(
  catalog: Catalog,
  paintId: PaintId,
): ColorStandIn | null {
  const paint = catalog.paint(paintId);
  if (paint === undefined) {
    throw new Error(`Paint ${paintId} is not in the catalog`);
  }
  if (paint.color !== null) return null;
  const replacement = resolveReplacement(catalog, paintId);
  if (replacement !== null) {
    return replacement.color === null
      ? null
      : Object.freeze({ paint: replacement, via: "replacement" });
  }
  const others = new Set<PaintId>([
    ...catalog.officialEquivalencesFrom(paintId).map((e) => e.to),
    ...catalog.officialEquivalencesTo(paintId).map((e) => e.from),
  ]);
  const [only] = others;
  if (only === undefined || others.size > 1) return null;
  const equivalent = catalog.paint(only);
  return equivalent?.color == null
    ? null
    : Object.freeze({ paint: equivalent, via: "equivalence" });
}

/** The result of {@link colorStandIn}. */
export interface ColorStandIn {
  /** The paint whose colour is used. It always has a colour. */
  readonly paint: Paint;
  /** Whether it is the replacement or the only official equivalence. */
  readonly via: "replacement" | "equivalence";
}
