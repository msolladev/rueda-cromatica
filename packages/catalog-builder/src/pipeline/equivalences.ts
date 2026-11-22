/**
 * The official equivalences of `catalog.json` (docs/04 §6, ADR-0033): each
 * equivalence of a chart whose two rows are keys of curated paints becomes an
 * edge `from → to` with the chart as its source. If either row is ignored,
 * the equivalence stays in the transcription and does not reach the catalog.
 * Nothing is inferred: no inverse and no transitive edge (ADR-0004). Pure.
 */
import {
  compareSortKeys,
  edgeSortKey,
  type OfficialEquivalence,
  type PaintId,
} from "@chromatic-wheel/domain";
import type { SourceFile } from "../curated/files.ts";
import { keyOf } from "./resolve.ts";

/**
 * The edges of the given sources, sorted by `(from, to, sourceId)` (docs/02
 * §1).
 *
 * @param owners - The paint of each key, from `resolveKeys`.
 */
export function officialEquivalences(
  sources: readonly SourceFile[],
  owners: ReadonlyMap<string, PaintId>,
): readonly OfficialEquivalence[] {
  const edges: OfficialEquivalence[] = [];
  for (const file of sources) {
    const sourceId = file.source.id;
    for (const { from, to } of file.equivalences) {
      const fromPaint = owners.get(keyOf(sourceId, from));
      const toPaint = owners.get(keyOf(sourceId, to));
      if (fromPaint === undefined || toPaint === undefined) continue;
      edges.push({ from: fromPaint, to: toPaint, sourceId });
    }
  }
  return edges.sort((a, b) => compareSortKeys(edgeSortKey(a), edgeSortKey(b)));
}
