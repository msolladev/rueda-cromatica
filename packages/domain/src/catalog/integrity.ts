/**
 * Referential integrity and cross-field invariants (docs/01 §5, docs/02 §3).
 * Runs on a structurally valid document and collects every violation.
 */
import type {
  Brand,
  BrandId,
  CatalogDocument,
  Paint,
  PaintId,
  Range,
  RangeId,
  Source,
  SourceId,
} from "./schema.ts";

/** A problem found in a catalog. */
export interface CatalogIssue {
  /** Where, such as `paints[12].status`. Empty for the whole document. */
  readonly path: string;
  /** What is wrong, in English. */
  readonly message: string;
}

/**
 * Lookup by ID, built once here and reused by the `Catalog` aggregate. With
 * duplicate IDs the first occurrence wins; the duplicates are reported.
 */
export interface CatalogIndexes {
  readonly sources: ReadonlyMap<SourceId, Source>;
  readonly brands: ReadonlyMap<BrandId, Brand>;
  readonly ranges: ReadonlyMap<RangeId, Range>;
  readonly paints: ReadonlyMap<PaintId, Paint>;
}

export interface IntegrityResult {
  readonly issues: readonly CatalogIssue[];
  readonly indexes: CatalogIndexes;
}

interface Identified {
  readonly id: string;
}

export function checkIntegrity(doc: CatalogDocument): IntegrityResult {
  const issues: CatalogIssue[] = [];
  const report = (path: string, message: string): void => {
    issues.push({ path, message });
  };

  // 1. Unique IDs per collection (formats are checked by the schema).
  const sources = indexUnique("sources", doc.sources, report);
  const brands = indexUnique("brands", doc.brands, report);
  const ranges = indexUnique("ranges", doc.ranges, report);
  const paints = indexUnique("paints", doc.paints, report);

  // 9. Deterministic order (docs/02 §1). Ties are duplicates, reported above.
  checkOrder("sources", doc.sources, idSortKey, report);
  checkOrder("brands", doc.brands, idSortKey, report);
  checkOrder("ranges", doc.ranges, idSortKey, report);
  checkOrder("paints", doc.paints, idSortKey, report);
  checkOrder("equivalences", doc.equivalences, edgeSortKey, report);

  const requireManufacturer = (path: string, id: SourceId): void => {
    const source = sources.get(id);
    if (source === undefined) {
      report(path, `Unknown source: ${id}`);
    } else if (source.kind !== "manufacturer") {
      report(path, `Source ${id} must have kind "manufacturer"`);
    }
  };

  // 8. A source without URL cannot have an archived copy.
  doc.sources.forEach((source, i) => {
    if (source.url === null && source.archiveUrl !== null) {
      report(
        `sources[${String(i)}].archiveUrl`,
        "Must be null when url is null",
      );
    }
  });

  // 7. Aliases (names are checked by the schema).
  doc.brands.forEach((brand, i) => {
    checkAliases(`brands[${String(i)}]`, brand.name, brand.aliases, report);
  });

  // 2. References from ranges.
  doc.ranges.forEach((range, i) => {
    if (!brands.has(range.brandId)) {
      report(`ranges[${String(i)}].brandId`, `Unknown brand: ${range.brandId}`);
    }
  });

  doc.paints.forEach((paint, i) => {
    const path = `paints[${String(i)}]`;
    checkAliases(path, paint.name, paint.aliases, report);

    // 2. References from paints.
    const range = ranges.get(paint.rangeId);
    if (range === undefined) {
      report(`${path}.rangeId`, `Unknown range: ${paint.rangeId}`);
    }
    if (paint.color !== null && !sources.has(paint.color.sourceId)) {
      report(
        `${path}.color.sourceId`,
        `Unknown source: ${paint.color.sourceId}`,
      );
    }

    // 3. A discontinued range only holds discontinued paints.
    if (range?.status === "discontinued" && paint.status.kind === "active") {
      report(
        `${path}.status.kind`,
        `Must be "discontinued" because range ${range.id} is discontinued`,
      );
    }

    // 2, 4 and 5. Replacement.
    if (paint.status.kind === "discontinued" && paint.status.replacement) {
      const { replacement } = paint.status;
      const replacementPath = `${path}.status.replacement`;
      if (replacement.paintId === paint.id) {
        report(`${replacementPath}.paintId`, "A paint cannot replace itself");
      } else if (!paints.has(replacement.paintId)) {
        report(
          `${replacementPath}.paintId`,
          `Unknown paint: ${replacement.paintId}`,
        );
      }
      requireManufacturer(`${replacementPath}.sourceId`, replacement.sourceId);
    }
  });

  // 4. Replacement chains without cycles.
  for (const cycle of findReplacementCycles(paints)) {
    const first = cycle[0];
    if (first === undefined) continue;
    const index = doc.paints.findIndex((paint) => paint.id === first);
    report(
      `paints[${String(index)}].status.replacement.paintId`,
      `Replacement cycle: ${[...cycle, first].join(" → ")}`,
    );
  }

  // 2, 5 and 6. Official equivalences.
  const seenEdges = new Map<string, number>();
  doc.equivalences.forEach((edge, i) => {
    const path = `equivalences[${String(i)}]`;
    for (const end of ["from", "to"] as const) {
      if (!paints.has(edge[end])) {
        report(`${path}.${end}`, `Unknown paint: ${edge[end]}`);
      }
    }
    if (edge.from === edge.to) {
      report(`${path}.to`, "Must differ from `from`");
    }
    requireManufacturer(`${path}.sourceId`, edge.sourceId);

    const key = JSON.stringify([edge.from, edge.to, edge.sourceId]);
    const previous = seenEdges.get(key);
    if (previous === undefined) {
      seenEdges.set(key, i);
    } else {
      report(
        path,
        `Duplicate of equivalences[${String(previous)}] (same from, to and sourceId)`,
      );
    }
  });

  return { issues, indexes: { sources, brands, ranges, paints } };
}

function indexUnique<T extends Identified>(
  collection: string,
  items: readonly T[],
  report: (path: string, message: string) => void,
): ReadonlyMap<T["id"], T> {
  const byId = new Map<T["id"], T>();
  items.forEach((item, i) => {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
      return;
    }
    // Errors are rare, so the first position is looked up only when needed.
    const first = items.findIndex((other) => other.id === item.id);
    report(
      `${collection}[${String(i)}].id`,
      `Duplicate ID ${item.id} (already used in ${collection}[${String(first)}])`,
    );
  });
  return byId;
}

// ── Catalog order (docs/02 §1) ───────────────────────────────
// The single definition of the order: the check below and whoever sorts a
// catalog (tests now, the builder later) use these.

/**
 * The sort key of an entity in the catalog: its ID. For
 * {@link compareSortKeys}.
 */
export const idSortKey = (item: { readonly id: string }): readonly string[] => [
  item.id,
];

/**
 * The sort key of an official equivalence: origin, destination and source.
 * For {@link compareSortKeys}.
 */
export const edgeSortKey = (edge: {
  readonly from: string;
  readonly to: string;
  readonly sourceId: string;
}): readonly string[] => [edge.from, edge.to, edge.sourceId];

/**
 * Compares sort keys element by element. Strings are compared by UTF-16 code
 * unit (JavaScript's default, no locale), so the order does not depend on the
 * machine. IDs are ASCII slugs, so this is plain byte order.
 */
export function compareSortKeys(
  a: readonly string[],
  b: readonly string[],
): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a[i] ?? "";
    const y = b[i] ?? "";
    if (x !== y) return x < y ? -1 : 1;
  }
  return a.length - b.length;
}

/** Each item must not sort before the previous one. */
function checkOrder<T>(
  collection: string,
  items: readonly T[],
  sortKey: (item: T) => readonly string[],
  report: (path: string, message: string) => void,
): void {
  let previous: readonly string[] | null = null;
  items.forEach((item, i) => {
    const current = sortKey(item);
    if (previous !== null && compareSortKeys(previous, current) > 0) {
      const suffix = current.length === 1 ? ".id" : "";
      report(
        `${collection}[${String(i)}]${suffix}`,
        `Out of order: must not come after ${collection}[${String(i - 1)}]`,
      );
    }
    previous = current;
  });
}

function checkAliases(
  path: string,
  name: string,
  aliases: readonly string[],
  report: (path: string, message: string) => void,
): void {
  const seen = new Set<string>();
  aliases.forEach((alias, i) => {
    const aliasPath = `${path}.aliases[${String(i)}]`;
    if (alias === name) {
      report(aliasPath, "Alias repeats the name");
    } else if (seen.has(alias)) {
      report(aliasPath, `Duplicate alias: ${alias}`);
    }
    seen.add(alias);
  });
}

/**
 * Each paint has at most one replacement, so the replacement graph is a
 * functional graph: every walk ends at a paint without replacement, at an
 * unknown ID or at a cycle. Each cycle is returned once, in walk order.
 * Self-replacements are reported separately and skipped here.
 */
function findReplacementCycles(
  paints: ReadonlyMap<PaintId, Paint>,
): readonly (readonly PaintId[])[] {
  const next = (id: PaintId): PaintId | undefined => {
    const status = paints.get(id)?.status;
    if (status?.kind !== "discontinued" || status.replacement === null) {
      return undefined;
    }
    const target = status.replacement.paintId;
    return target === id ? undefined : target;
  };

  const done = new Set<PaintId>();
  const cycles: PaintId[][] = [];
  for (const start of paints.keys()) {
    const walk: PaintId[] = [];
    const onWalk = new Set<PaintId>();
    let current: PaintId | undefined = start;
    while (current !== undefined && !done.has(current)) {
      if (onWalk.has(current)) {
        cycles.push(walk.slice(walk.indexOf(current)));
        break;
      }
      walk.push(current);
      onWalk.add(current);
      current = next(current);
    }
    for (const id of walk) done.add(id);
  }
  return cycles;
}
