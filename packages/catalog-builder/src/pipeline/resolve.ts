/**
 * Key resolution (docs/04 §6, step 2): crosses every row of every source with
 * the curated paints through their keys. Each row ends up with exactly one
 * paint, or ignored by its group or its key; anything else is an issue. Also
 * checks the reasons cited by ignores and rejected colours, and that every
 * equivalence of a chart joins two rows of its source (ADR-0033).
 * Shared by the builder and the importers' reconciliation. Pure.
 */
import type { PaintId, SourceId } from "@chromatic-wheel/domain";
import type {
  BrandFile,
  DataIssue,
  IgnoreReason,
  SourceFile,
  SourceRow,
} from "../model/curated.ts";

export interface ResolveInput {
  readonly sources: readonly SourceFile[];
  readonly brands: readonly BrandFile[];
  readonly reasons: {
    readonly name: string;
    readonly reasons: readonly IgnoreReason[];
  };
}

/** A source row with the source it comes from and where it is written. */
export interface ResolvedRow {
  readonly sourceId: SourceId;
  readonly row: SourceRow;
  /** The source file and the path of the row in it, to point issues at. */
  readonly at: { readonly file: string; readonly path: string };
}

export interface Resolution {
  /** The rows of each paint, by paint ID, in the order of its keys. */
  readonly rows: ReadonlyMap<string, readonly ResolvedRow[]>;
  /** The paint of each key, by `keyOf(sourceId, key)`. */
  readonly owners: ReadonlyMap<string, PaintId>;
  /** Rows with no paint and not ignored. Each one is also in `issues`. */
  readonly uncovered: readonly ResolvedRow[];
  readonly issues: readonly DataIssue[];
}

interface IndexedSource {
  readonly file: SourceFile;
  /** Row index by key. */
  readonly rows: ReadonlyMap<string, number>;
  readonly ignoredGroups: ReadonlySet<string>;
  readonly ignoredKeys: ReadonlySet<string>;
}

/** How {@link Resolution.owners} identifies a key of a source. */
export const keyOf = (sourceId: string, key: string): string =>
  `${sourceId}\n${key}`;

export function resolveKeys(input: ResolveInput): Resolution {
  const issues: DataIssue[] = [];
  const reasonIds = new Set(input.reasons.reasons.map((r) => r.id));
  const usedReasons = new Set<string>();
  const checkReason = (file: string, path: string, reasonId: string): void => {
    usedReasons.add(reasonId);
    if (!reasonIds.has(reasonId)) {
      issues.push({
        file,
        path: `${path}.reasonId`,
        message: `Unknown reason ${reasonId}; add it to ${input.reasons.name}`,
      });
    }
  };

  // 1. Index each source: its rows by key and its ignores.
  const sources = new Map<string, IndexedSource>();
  for (const file of input.sources) {
    sources.set(file.source.id, indexSource(file, issues, checkReason));
  }

  // 2. Index the keys of the curated paints.
  const owner = new Map<string, PaintId>(); // keyOf(sourceId, key) → paint ID
  const rows = new Map<string, ResolvedRow[]>();
  for (const brand of input.brands) {
    brand.paints.forEach((paint, i) => {
      const resolved: ResolvedRow[] = [];
      paint.keys.forEach(({ sourceId, key }, k) => {
        const at = {
          file: brand.name,
          path: `paints[${String(i)}].keys[${String(k)}]`,
        };
        const source = sources.get(sourceId);
        if (source === undefined) {
          issues.push({ ...at, message: `Unknown source ${sourceId}` });
          return;
        }
        const rowIndex = source.rows.get(key);
        if (rowIndex === undefined) {
          issues.push({
            ...at,
            message: `${sourceId} has no row with key "${key}"`,
          });
          return;
        }
        const id = keyOf(sourceId, key);
        const other = owner.get(id);
        if (other !== undefined) {
          issues.push({
            ...at,
            message: `Key "${key}" of ${sourceId} is also a key of ${other}`,
          });
          return;
        }
        owner.set(id, paint.id);
        const row = source.file.paints[rowIndex];
        if (row !== undefined) {
          const path = `paints[${String(rowIndex)}]`;
          resolved.push({
            sourceId,
            row,
            at: { file: source.file.name, path },
          });
        }
      });
      paint.rejectedColors.forEach(({ reasonId }, r) => {
        const path = `paints[${String(i)}].rejectedColors[${String(r)}]`;
        checkReason(brand.name, path, reasonId);
      });
      rows.set(paint.id, resolved);
    });
  }

  // 3. Every row: one paint, or ignored, never both nor neither.
  const uncovered: ResolvedRow[] = [];
  for (const source of sources.values()) {
    const sourceId = source.file.source.id;
    source.file.paints.forEach((row, i) => {
      const paint = owner.get(keyOf(sourceId, row.key));
      const ignored =
        source.ignoredGroups.has(row.group) || source.ignoredKeys.has(row.key);
      const at = { file: source.file.name, path: `paints[${String(i)}]` };
      if (paint !== undefined && ignored) {
        issues.push({
          ...at,
          message: `"${row.key}" is ignored but is a key of ${paint}; remove the stale ignore`,
        });
      } else if (paint === undefined && !ignored) {
        uncovered.push({ sourceId, row, at });
        issues.push({
          ...at,
          message: `"${row.key}" (${row.group}) is not a key of any paint and is not ignored`,
        });
      }
    });
  }

  // 4. Reasons nobody uses.
  input.reasons.reasons.forEach((reason, i) => {
    if (!usedReasons.has(reason.id)) {
      issues.push({
        file: input.reasons.name,
        path: `[${String(i)}]`,
        message: `Reason ${reason.id} is not used by any ignore or rejected colour`,
      });
    }
  });

  return { rows, owners: owner, uncovered, issues };
}

function indexSource(
  file: SourceFile,
  issues: DataIssue[],
  checkReason: (file: string, path: string, reasonId: string) => void,
): IndexedSource {
  const report = (path: string, message: string): void => {
    issues.push({ file: file.name, path, message });
  };

  const rows = new Map<string, number>();
  const groups = new Set<string>();
  file.paints.forEach((row, i) => {
    groups.add(row.group);
    if (rows.has(row.key)) {
      report(`paints[${String(i)}].key`, `Key "${row.key}" is repeated`);
    } else {
      rows.set(row.key, i);
    }
  });

  const pairs = new Set<string>();
  file.equivalences.forEach(({ from, to }, i) => {
    const path = `equivalences[${String(i)}]`;
    for (const [side, key] of [
      ["from", from],
      ["to", to],
    ] as const) {
      if (!rows.has(key)) report(`${path}.${side}`, `No row has key "${key}"`);
    }
    const pair = `${from}\n${to}`;
    if (pairs.has(pair)) {
      report(path, `The equivalence "${from}" → "${to}" is repeated`);
    }
    pairs.add(pair);
  });

  // A replacement needs a manufacturer document (ADR-0005), and a document
  // names at most one replacement for each paint.
  const replaced = new Set<string>();
  file.replacements.forEach(({ from, to }, i) => {
    const path = `replacements[${String(i)}]`;
    if (file.source.kind !== "manufacturer") {
      report(path, "Only a manufacturer document states replacements");
    }
    for (const [side, key] of [
      ["from", from],
      ["to", to],
    ] as const) {
      if (!rows.has(key)) report(`${path}.${side}`, `No row has key "${key}"`);
    }
    if (replaced.has(from)) {
      report(path, `"${from}" has more than one replacement in this source`);
    }
    replaced.add(from);
  });

  const ignoredGroups = new Set<string>();
  file.ignoredGroups.forEach(({ group, reasonId }, i) => {
    const path = `ignoredGroups[${String(i)}]`;
    checkReason(file.name, path, reasonId);
    if (ignoredGroups.has(group)) report(path, `Group "${group}" is repeated`);
    else if (!groups.has(group)) {
      report(path, `No row is in group "${group}"; remove the stale ignore`);
    }
    ignoredGroups.add(group);
  });

  const ignoredKeys = new Set<string>();
  file.ignoredKeys.forEach(({ key, reasonId }, i) => {
    const path = `ignoredKeys[${String(i)}]`;
    checkReason(file.name, path, reasonId);
    const rowIndex = rows.get(key);
    const group =
      rowIndex === undefined ? undefined : file.paints[rowIndex]?.group;
    if (ignoredKeys.has(key)) report(path, `Key "${key}" is repeated`);
    else if (group === undefined) {
      report(path, `No row has key "${key}"; remove the stale ignore`);
    } else if (ignoredGroups.has(group)) {
      report(path, `"${key}" is already ignored by its group "${group}"`);
    }
    ignoredKeys.add(key);
  });

  return { file, rows, ignoredGroups, ignoredKeys };
}
