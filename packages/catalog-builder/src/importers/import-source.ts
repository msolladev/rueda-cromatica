/**
 * One import of a source (docs/04 §7), once its files are transcribed: for a
 * chart, the keys of its rows in the curated paints (ADR-0033); then the
 * reconciliation of the rows with the curated paints. It gives the source
 * with its new rows and the brands that change, for whoever stores them.
 * Pure.
 */
import { ok, type Result } from "@chromatic-wheel/domain";
import type {
  BrandFile,
  Curated,
  CuratedPaint,
  DataIssue,
  SourceFile,
} from "../model/curated.ts";
import type { Transcription } from "./chart.ts";
import { proposeKeys, type KeyProposals } from "./chart-keys.ts";
import { reconcile, type Difference } from "./reconcile.ts";
import type { SourceImporter } from "./registry.ts";

export interface ImportInput {
  readonly curated: Curated;
  /** The source imported, as it is in the curated data. */
  readonly source: SourceFile;
  readonly importer: Pick<SourceImporter, "rules" | "keys">;
  readonly transcription: Transcription;
}

export interface Imported {
  /** The source with the transcribed rows and equivalences. */
  readonly source: SourceFile;
  /** The brands with new paints or new keys, with their paints in place. */
  readonly brands: readonly BrandFile[];
  readonly proposals: readonly CuratedPaint[];
  /** For a chart, the keys added and the rows without a single paint. */
  readonly keys: KeyProposals | null;
  readonly differences: readonly Difference[];
  readonly pending: readonly DataIssue[];
}

export function importSource(
  input: ImportInput,
): Result<Imported, readonly string[]> {
  const { curated, source, importer, transcription } = input;
  const sourceId = source.source.id;
  const { paints, equivalences } = transcription;

  // A chart keys its rows to the curated paints before reconciling.
  const keys =
    importer.keys === null
      ? null
      : proposeKeys({
          current: curated,
          sourceId,
          rows: paints,
          rules: importer.keys,
        });
  const keyed = new Map(keys?.brands.map((b) => [b.name, b]));
  const current = {
    ...curated,
    brands: curated.brands.map((b) => keyed.get(b.name) ?? b),
  };

  const result = reconcile({
    current,
    sourceId,
    rows: paints,
    rules: importer.rules,
  });
  if (!result.ok) return result;

  const changed = new Map(keyed);
  for (const brand of result.value.brands) changed.set(brand.name, brand);
  return ok({
    source: { ...source, paints, equivalences },
    brands: [...changed.values()],
    proposals: result.value.proposals,
    keys,
    differences: result.value.differences,
    pending: result.value.pending,
  });
}
