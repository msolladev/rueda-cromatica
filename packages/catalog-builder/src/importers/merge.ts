/**
 * Merges the paints read from a source into the paints of a brand file
 * (docs/04 §4). Shared by every importer; pure.
 */
import {
  compareSortKeys,
  err,
  idSortKey,
  ok,
  type paintSchema,
  type Result,
} from "@rueda-cromatica/domain";
import type { z } from "zod";
import { proposeSlug } from "./slug.ts";

/** A paint as stored in a brand file, before validation. */
export type PaintRow = z.input<typeof paintSchema>;

/** What a source says about a paint. The curated fields stay out. */
export type ImportedPaint = Pick<
  PaintRow,
  "rangeId" | "name" | "manufacturerCode" | "type" | "metallic" | "color"
> & {
  /** Slug chosen by hand when the proposed one collides (docs/03 §3). */
  readonly slug?: string;
};

export interface MergedPaints {
  /** Every paint of the brand, sorted by ID. */
  readonly paints: readonly PaintRow[];
  /** Existing paints the source no longer lists. They are kept. */
  readonly missing: readonly PaintRow[];
}

export function mergePaints(
  existing: readonly PaintRow[],
  imported: readonly ImportedPaint[],
): Result<MergedPaints, readonly string[]> {
  // By code within the range; by name only when a side has no code, since
  // two paints of a range can share a name (docs/04 §4).
  const byCode = new Map<string, PaintRow>();
  const byName = new Map<string, PaintRow>();
  const byNameWithoutCode = new Map<string, PaintRow>();
  for (const paint of existing) {
    const nameKey = key(paint.rangeId, paint.name);
    byName.set(nameKey, paint);
    if (paint.manufacturerCode === null) byNameWithoutCode.set(nameKey, paint);
    else byCode.set(key(paint.rangeId, paint.manufacturerCode), paint);
  }

  const issues: string[] = [];
  const merged = new Map<string, PaintRow>();
  const ids = new Set(existing.map((paint) => paint.id));
  const seen = new Set<string>();

  for (const row of imported) {
    const rowKey = key(row.rangeId, row.manufacturerCode ?? row.name);
    if (seen.has(rowKey)) {
      issues.push(`${row.rangeId}: "${row.name}" appears twice in the source`);
      continue;
    }
    seen.add(rowKey);

    const nameKey = key(row.rangeId, row.name);
    const match =
      row.manufacturerCode === null
        ? byName.get(nameKey)
        : (byCode.get(key(row.rangeId, row.manufacturerCode)) ??
          byNameWithoutCode.get(nameKey));

    if (match !== undefined) {
      merged.set(match.id, update(match, row));
      continue;
    }

    const id = `${row.rangeId}/${row.slug ?? proposeSlug(row.name)}`;
    if (ids.has(id)) {
      issues.push(
        `${id}: already taken; choose a suffix by hand for "${row.name}" (docs/03 §3)`,
      );
      continue;
    }
    ids.add(id);
    merged.set(id, {
      id,
      rangeId: row.rangeId,
      name: row.name,
      aliases: [],
      manufacturerCode: row.manufacturerCode,
      type: row.type,
      metallic: row.metallic,
      color: row.color,
      status: { kind: "active" },
    });
  }
  if (issues.length > 0) return err(issues);

  const missing = existing.filter((paint) => !merged.has(paint.id));
  const paints = [...merged.values(), ...missing].sort((a, b) =>
    compareSortKeys(idSortKey(a), idSortKey(b)),
  );
  return ok({ paints, missing });
}

/**
 * The source rules what it publishes; the curated fields (ID, status) stay. A
 * paint found by its code under another name has been renamed (docs/03 §5).
 */
function update(current: PaintRow, row: ImportedPaint): PaintRow {
  // Aliases never repeat the name (docs/02 §3).
  const aliases =
    row.name === current.name
      ? current.aliases
      : [...current.aliases, current.name].filter((a) => a !== row.name);
  return {
    ...current,
    name: row.name,
    aliases,
    manufacturerCode: row.manufacturerCode ?? current.manufacturerCode,
    type: row.type,
    metallic: row.metallic,
    color: row.color,
  };
}

const key = (rangeId: string, value: string): string => `${rangeId}\n${value}`;
