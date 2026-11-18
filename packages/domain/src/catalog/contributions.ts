/**
 * What each source of the catalog backs (ADR-0015): the data that the credits
 * of an interface attribute to it.
 */
import type { Catalog } from "./catalog.ts";
import type { Brand, Range, Source, SourceId } from "./schema.ts";

/** The paint colours of one brand that come from a source. */
export interface BrandColorContribution {
  /** The brand. */
  readonly brand: Brand;
  /** The ranges with at least one colour from the source, in catalog order. */
  readonly ranges: readonly Range[];
  /** How many paints of the brand take their colour from the source. */
  readonly paintCount: number;
}

/** What one source backs in the catalog. */
export interface SourceContribution {
  /** The source. */
  readonly source: Source;
  /**
   * The paint colours it gives, by brand in catalog order. Only brands with
   * at least one colour from it.
   */
  readonly colors: readonly BrandColorContribution[];
  /** How many replacements of discontinued paints it backs. */
  readonly replacementCount: number;
  /** How many official equivalences it backs. */
  readonly officialEquivalenceCount: number;
}

/**
 * Every source of the catalog, in catalog order, with what it backs: paint
 * colours, replacements and official equivalences. A source that backs
 * nothing is listed too, with empty colours and zero counts. The result is
 * frozen.
 *
 * @example
 * ```ts
 * for (const { source, colors } of sourceContributions(catalog)) {
 *   console.log(source.title, colors.map((c) => c.brand.name));
 * }
 * ```
 */
export function sourceContributions(
  catalog: Catalog,
): readonly SourceContribution[] {
  const colorCounts = new Map<SourceId, Map<Range, number>>();
  const replacements = new Map<SourceId, number>();
  const equivalences = new Map<SourceId, number>();
  const increment = <K>(map: Map<K, number>, key: K) => {
    map.set(key, (map.get(key) ?? 0) + 1);
  };

  const all = catalog.paints({ brandIds: "all", includeDiscontinued: true });
  for (const paint of all) {
    if (paint.color !== null) {
      const byRange =
        colorCounts.get(paint.color.sourceId) ?? new Map<Range, number>();
      colorCounts.set(paint.color.sourceId, byRange);
      const range = catalog.range(paint.rangeId);
      if (range !== undefined) increment(byRange, range);
    }
    if (
      paint.status.kind === "discontinued" &&
      paint.status.replacement !== null
    ) {
      increment(replacements, paint.status.replacement.sourceId);
    }
    for (const edge of catalog.officialEquivalencesFrom(paint.id)) {
      increment(equivalences, edge.sourceId);
    }
  }

  return Object.freeze(
    catalog.sources().map((source) => {
      const byRange = colorCounts.get(source.id) ?? new Map<Range, number>();
      const colors = catalog.brands().flatMap((brand) => {
        const ranges = catalog
          .rangesOf(brand.id)
          .filter((range) => byRange.has(range));
        if (ranges.length === 0) return [];
        const paintCount = ranges.reduce(
          (sum, range) => sum + (byRange.get(range) ?? 0),
          0,
        );
        return [
          Object.freeze({ brand, ranges: Object.freeze(ranges), paintCount }),
        ];
      });
      return Object.freeze({
        source,
        colors: Object.freeze(colors),
        replacementCount: replacements.get(source.id) ?? 0,
        officialEquivalenceCount: equivalences.get(source.id) ?? 0,
      });
    }),
  );
}
