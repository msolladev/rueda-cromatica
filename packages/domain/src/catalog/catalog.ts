/**
 * Read-only aggregate over a validated catalog (docs/01 §3). The indexes are
 * private to the closure; only `parseCatalog` builds instances.
 */
import type {
  Brand,
  BrandId,
  CatalogDocument,
  CatalogMeta,
  OfficialEquivalence,
  Paint,
  PaintId,
  Range,
  RangeId,
  Source,
  SourceId,
} from "./schema.ts";
import type { CatalogIndexes } from "./integrity.ts";

/** Which paints {@link Catalog.paints} returns. Both fields are required. */
export interface PaintQuery {
  /**
   * The brands, in any order and with repetitions, or `"all"`. An ID that is
   * not in the catalog is ignored.
   */
  readonly brandIds: readonly BrandId[] | "all";
  /** Whether discontinued paints are included. */
  readonly includeDiscontinued: boolean;
}

/**
 * The catalog, already validated and read-only. It is the only access to the
 * data from the interface, and hides its internal indexes. Only
 * {@link parseCatalog} creates it, and everything it returns is frozen.
 */
export interface Catalog {
  /** Versions of the format and of the data. */
  readonly meta: CatalogMeta;
  /** Every brand, in catalog order. */
  brands(): readonly Brand[];
  /**
   * The ranges of a brand, in catalog order. Empty if the brand has none or
   * is not in the catalog.
   */
  rangesOf(brandId: BrandId): readonly Range[];
  /** The brand with that ID, or `undefined`. */
  brand(id: BrandId): Brand | undefined;
  /** The range with that ID, or `undefined`. */
  range(id: RangeId): Range | undefined;
  /** The paint with that ID, or `undefined`. */
  paint(id: PaintId): Paint | undefined;
  /** The source with that ID, or `undefined`. */
  source(id: SourceId): Source | undefined;
  /**
   * The paints of the brands of `query`, grouped by brand in catalog order
   * and, within each brand, by ID, whatever the order of `brandIds`.
   */
  paints(query: PaintQuery): readonly Paint[];
  /**
   * The brand of a paint, through its range. It never reads the ID's prefix.
   *
   * @throws Error if the paint is not in this catalog.
   */
  brandOf(paint: Paint): Brand;
  /** The official equivalences whose origin is the paint, in catalog order. */
  officialEquivalencesFrom(id: PaintId): readonly OfficialEquivalence[];
  /** The official equivalences whose destination is the paint, in catalog order. */
  officialEquivalencesTo(id: PaintId): readonly OfficialEquivalence[];
}

const EMPTY: readonly never[] = Object.freeze([]);

/**
 * Assumes `doc` passed `checkIntegrity` without issues, and reuses the lookup
 * tables that check built instead of building them again.
 */
export function createCatalog(
  doc: CatalogDocument,
  { sources, brands, ranges, paints }: CatalogIndexes,
): Catalog {
  // The only way to get a paint's brand: through its range in this catalog,
  // never from the ID prefix (docs/03 §2). Throws for a foreign paint.
  const brandIdOf = (paint: Paint): BrandId => {
    const own = required(paints.get(paint.id), paint.id);
    return required(ranges.get(own.rangeId), own.rangeId).brandId;
  };

  const isActive = (paint: Paint): boolean => paint.status.kind === "active";

  // Precomputed answers to `paints()`, so a query only touches what it returns.
  const activePaints = Object.freeze(doc.paints.filter(isActive));
  const paintsByBrand = groupBy(doc.paints, brandIdOf);
  const activePaintsByBrand = groupBy(activePaints, brandIdOf);

  const rangesByBrand = groupBy(doc.ranges, (range) => range.brandId);
  const edgesFrom = groupBy(doc.equivalences, (edge) => edge.from);
  const edgesTo = groupBy(doc.equivalences, (edge) => edge.to);

  return Object.freeze({
    meta: doc.meta,
    brands: () => doc.brands,
    rangesOf: (brandId) => rangesByBrand.get(brandId) ?? EMPTY,
    brand: (id) => brands.get(id),
    range: (id) => ranges.get(id),
    paint: (id) => paints.get(id),
    source: (id) => sources.get(id),
    // Grouped by brand in catalog order, then by ID, whatever the order or
    // repetitions of `brandIds`. Only the selected brands are visited.
    paints: ({ brandIds, includeDiscontinued }) => {
      if (brandIds === "all") {
        return includeDiscontinued ? doc.paints : activePaints;
      }
      const byBrand = includeDiscontinued ? paintsByBrand : activePaintsByBrand;
      const wanted = new Set(brandIds);
      const lists = doc.brands
        .filter((brand) => wanted.has(brand.id))
        .map((brand) => byBrand.get(brand.id) ?? EMPTY);
      return lists.length === 1 ? (lists[0] ?? EMPTY) : lists.flat();
    },
    brandOf: (paint) => {
      const brandId = brandIdOf(paint);
      return required(brands.get(brandId), brandId);
    },
    officialEquivalencesFrom: (id) => edgesFrom.get(id) ?? EMPTY,
    officialEquivalencesTo: (id) => edgesTo.get(id) ?? EMPTY,
  } satisfies Catalog);
}

function groupBy<T, K>(
  items: readonly T[],
  keyOf: (item: T) => K,
): ReadonlyMap<K, readonly T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [item]);
    else group.push(item);
  }
  for (const group of groups.values()) Object.freeze(group);
  return groups;
}

function required<T>(value: T | undefined, id: string): T {
  if (value === undefined) {
    throw new Error(`Catalog invariant broken: unknown reference ${id}`);
  }
  return value;
}
