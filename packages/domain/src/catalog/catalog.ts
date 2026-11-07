/**
 * Read-only aggregate over a validated catalog (docs/01 §3-4). The indexes are
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

export interface PaintQuery {
  readonly brandIds: readonly BrandId[] | "all";
  readonly includeDiscontinued: boolean;
}

export interface Catalog {
  readonly meta: CatalogMeta;
  brands(): readonly Brand[];
  rangesOf(brandId: BrandId): readonly Range[];
  brand(id: BrandId): Brand | undefined;
  range(id: RangeId): Range | undefined;
  paint(id: PaintId): Paint | undefined;
  source(id: SourceId): Source | undefined;
  paints(query: PaintQuery): readonly Paint[];
  /** Cannot fail for a paint of this catalog; throws if its ID is not here. */
  brandOf(paint: Paint): Brand;
  officialEquivalencesFrom(id: PaintId): readonly OfficialEquivalence[];
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
