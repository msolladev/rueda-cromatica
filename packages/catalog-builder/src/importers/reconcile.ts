/**
 * Reconciliation of a new transcription with the curated paints (docs/04
 * §7). Proposes a paint for every new row that is neither a key nor ignored,
 * and lists what Miguel has to decide. It never changes an existing paint: a
 * third-party source is a hint, not proof (docs/04 §8). Shared by every
 * importer; pure.
 */
import {
  compareSortKeys,
  err,
  idSortKey,
  ok,
  paintIdSchema,
  rangeIdSchema,
  type PaintType,
  type Result,
  type SourceId,
} from "@chromatic-wheel/domain";
import type {
  BrandFile,
  CuratedPaint,
  DataIssue,
  SourceRow,
} from "../curated/files.ts";
import { resolveKeys, type ResolveInput } from "../pipeline/resolve.ts";
import { proposeSlug } from "./slug.ts";

/** Where the new rows of each group of a source go. */
export interface ProposalRules {
  readonly groups: Readonly<
    Record<
      string,
      {
        readonly rangeId: string;
        readonly type: PaintType;
        readonly metallic: boolean;
      }
    >
  >;
  /** The official name, when the source adds something to it. */
  readonly name?: (row: SourceRow) => string;
  /** Metallic from the row itself, when the source says so. */
  readonly metallic?: (row: SourceRow) => boolean;
}

export interface ReconcileInput {
  /** The curated data as it is, with the previous transcription. */
  readonly current: ResolveInput;
  readonly sourceId: SourceId;
  /** The new transcription of that source. */
  readonly rows: readonly SourceRow[];
  readonly rules: ProposalRules;
}

/** A field where a row changed in this revision and differs from its paint. */
export interface Difference {
  readonly paintId: string;
  readonly field: "name" | "manufacturerCode";
  readonly source: string | null;
  readonly curated: string | null;
}

export interface Reconciliation {
  /** New paints, one per new row, keyed to it. */
  readonly proposals: readonly CuratedPaint[];
  /** The brand files that receive proposals, with their paints sorted. */
  readonly brands: readonly BrandFile[];
  /**
   * Rows that changed since the previous transcription and now differ from
   * their paint. Structured, so a later step could apply them.
   */
  readonly differences: readonly Difference[];
  /** What the builder will still reject once the proposals are added. */
  readonly pending: readonly DataIssue[];
}

export function reconcile(
  input: ReconcileInput,
): Result<Reconciliation, readonly string[]> {
  const { current, sourceId, rows, rules } = input;
  const previous = current.sources.find((s) => s.source.id === sourceId);
  if (previous === undefined) return err([`Unknown source ${sourceId}`]);
  const next = { ...previous, paints: rows };
  const sources = current.sources.map((s) => (s === previous ? next : s));
  const resolution = resolveKeys({ ...current, sources });

  // 1. A proposed paint for every uncovered row of this source.
  const ids = new Set(current.brands.flatMap((b) => b.paints.map((p) => p.id)));
  const proposals: CuratedPaint[] = [];
  const issues: string[] = [];
  for (const { row } of resolution.uncovered.filter(
    (r) => r.sourceId === sourceId,
  )) {
    const rule = rules.groups[row.group];
    if (rule === undefined) {
      issues.push(
        `"${row.key}" (${row.group}): no rule for its group; ignore it or add its paint by hand`,
      );
      continue;
    }
    const name = rules.name?.(row) ?? row.name;
    const id = paintIdSchema.safeParse(`${rule.rangeId}/${proposeSlug(name)}`);
    if (!id.success) {
      issues.push(`"${row.key}": no valid ID from the name "${name}"`);
      continue;
    }
    if (ids.has(id.data)) {
      issues.push(
        `"${row.key}": ${id.data} is already taken; add its paint by hand with a suffix (docs/03 §3)`,
      );
      continue;
    }
    ids.add(id.data);
    proposals.push({
      id: id.data,
      rangeId: rangeIdSchema.parse(rule.rangeId),
      name,
      aliases: [],
      manufacturerCode: row.code,
      type: rule.type,
      metallic: rules.metallic?.(row) ?? rule.metallic,
      status: { kind: "active" },
      keys: [{ sourceId, key: row.key }],
      note: null,
    });
  }
  if (issues.length > 0) return err(issues);

  // 2. Rows changed in this revision that no longer match their paint.
  const before = new Map(previous.paints.map((row) => [row.key, row]));
  const differences: Difference[] = [];
  for (const brand of current.brands) {
    for (const paint of brand.paints) {
      for (const { sourceId: from, row } of resolution.rows.get(paint.id) ??
        []) {
        const old = before.get(row.key);
        const changed =
          old === undefined || old.name !== row.name || old.code !== row.code;
        if (from !== sourceId || !changed) continue;
        const name = rules.name?.(row) ?? row.name;
        if (name !== paint.name) {
          differences.push({
            paintId: paint.id,
            field: "name",
            source: name,
            curated: paint.name,
          });
        }
        if (row.code !== paint.manufacturerCode) {
          differences.push({
            paintId: paint.id,
            field: "manufacturerCode",
            source: row.code,
            curated: paint.manufacturerCode,
          });
        }
      }
    }
  }

  // 3. What is left once the proposals are in: stale keys and ignores.
  const brands = current.brands.map((brand) => {
    const ranges = new Set(brand.ranges.map((r) => r.id));
    const added = proposals.filter((p) => ranges.has(p.rangeId));
    if (added.length === 0) return brand;
    const paints = [...brand.paints, ...added].sort((a, b) =>
      compareSortKeys(idSortKey(a), idSortKey(b)),
    );
    return { ...brand, paints };
  });
  const placed = new Set(brands.flatMap((b) => b.paints.map((p) => p.id)));
  const lost = proposals.filter((p) => !placed.has(p.id));
  if (lost.length > 0) {
    return err(lost.map((p) => `${p.id}: its range is in no brand file`));
  }
  const pending = resolveKeys({ ...current, sources, brands }).issues;

  const changed = brands.filter((b, i) => b !== current.brands[i]);
  return ok({ proposals, brands: changed, differences, pending });
}
