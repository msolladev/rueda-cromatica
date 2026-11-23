/**
 * Flow shared by the importer entry points (docs/04 §7): fetches the files of
 * the source (`source-files.ts`) at the URL of its file, transcribes it,
 * reconciles it with the curated paints and writes the source file and the
 * proposed paints, or, for a chart, the proposed keys (ADR-0033). The
 * importer logic itself stays pure.
 */
import { ok, type Result, type SourceId } from "@chromatic-wheel/domain";
import {
  readBrandFile,
  readCurated,
  readSourceFile,
  sourceContent,
  type SourceFile,
  type SourceRow,
} from "../curated/files.ts";
import type { Transcription } from "../importers/chart.ts";
import { proposeKeys, type KeyRules } from "../importers/chart-keys.ts";
import { reconcile, type ProposalRules } from "../importers/reconcile.ts";
import {
  dataPath,
  printIssues,
  readCuratedFiles,
  writeDataFile,
} from "./data-files.ts";
import { sourceFiles } from "./source-files.ts";

/** A file of the source as fetched: its URL and its bytes. */
export interface FetchedFile {
  readonly name: string;
  readonly bytes: Uint8Array;
}

export interface ImportOptions {
  readonly sourceId: SourceId;
  readonly transcribe: (
    files: readonly FetchedFile[],
  ) =>
    | Result<Transcription, readonly string[]>
    | Promise<Result<Transcription, readonly string[]>>;
  /** `null` for a source that never proposes paints (see `reconcile`). */
  readonly rules: ProposalRules | null;
  /** For a chart: how its rows find their curated paint (`proposeKeys`). */
  readonly keys?: KeyRules;
}

/** The text of a fetched file, for the sources published as text. */
export const fileText = (file: FetchedFile): string =>
  new TextDecoder().decode(file.bytes);

/** The transcription of a source that only has rows, not equivalences. */
export const rowsOnly = (
  rows: Result<readonly SourceRow[], readonly string[]>,
): Result<Transcription, readonly string[]> =>
  rows.ok ? ok({ paints: rows.value, equivalences: [] }) : rows;

function fail(messages: readonly string[]): number {
  for (const message of messages) console.error(message);
  return 1;
}

export async function runImport(options: ImportOptions): Promise<number> {
  const files = await readCuratedFiles();
  if (!files.ok) return fail(files.error);
  const curated = readCurated(files.value.data);
  if (!curated.ok) {
    printIssues(curated.error);
    return 1;
  }
  const { sources } = curated.value;

  const source = sources.find((s) => s.source.id === options.sourceId);
  if (source === undefined) {
    return fail([`No source file for ${options.sourceId}`]);
  }
  const targets = sourceFiles(source.source);
  if (!targets.ok) {
    return fail([`${dataPath(source.name)}: ${targets.error}`]);
  }
  if (targets.value === null || targets.value.length === 0) {
    return fail([`${dataPath(source.name)}: ${options.sourceId} has no URL`]);
  }

  const fetched: FetchedFile[] = [];
  for (const { url } of targets.value) {
    const response = await fetch(url);
    if (!response.ok) {
      return fail([`Could not fetch ${url}: HTTP ${String(response.status)}`]);
    }
    fetched.push({
      name: url,
      bytes: new Uint8Array(await response.arrayBuffer()),
    });
  }
  const transcription = await options.transcribe(fetched);
  if (!transcription.ok) return fail(transcription.error);
  const { paints, equivalences } = transcription.value;

  // A chart keys its rows to the curated paints before reconciling.
  const keys =
    options.keys === undefined
      ? null
      : proposeKeys({
          current: curated.value,
          sourceId: options.sourceId,
          rows: paints,
          rules: options.keys,
        });
  const keyed = new Map(keys?.brands.map((b) => [b.name, b]));
  const current = {
    ...curated.value,
    brands: curated.value.brands.map((b) => keyed.get(b.name) ?? b),
  };

  const result = reconcile({
    current,
    sourceId: options.sourceId,
    rows: paints,
    rules: options.rules,
  });
  if (!result.ok) return fail(result.error);
  const { proposals, differences, pending } = result.value;

  // Never write a file that does not pass its own checks.
  const sourceFile: SourceFile = {
    ...source,
    paints,
    equivalences,
  };
  const writes: { name: string; content: unknown }[] = [
    { name: source.name, content: sourceContent(sourceFile) },
  ];
  const changed = new Map(keyed);
  for (const brand of result.value.brands) changed.set(brand.name, brand);
  for (const brand of changed.values()) {
    writes.push({
      name: brand.name,
      content: {
        brand: brand.brand,
        ranges: brand.ranges,
        paints: brand.paints,
      },
    });
  }
  const invalid = [
    readSourceFile(writes[0] ?? { name: source.name, content: null }),
    ...writes.slice(1).map(readBrandFile),
  ].flatMap((check) => (check.ok ? [] : check.error));
  if (invalid.length > 0) {
    printIssues(invalid);
    return 1;
  }
  for (const write of writes) await writeDataFile(write.name, write.content);

  console.log(
    `${dataPath(source.name)}: ${String(paints.length)} rows, ${String(equivalences.length)} equivalences, ${String(proposals.length)} new paint(s)`,
  );
  for (const paint of proposals) console.log(`  + ${paint.id}`);
  if (keys !== null) {
    console.log(
      `  ${String(keys.added.length)} key(s) added to curated paints`,
    );
    if (keys.unmatched.length > 0) {
      console.log("\nRows without a single paint (key or ignore by hand):");
      for (const { key, candidates } of keys.unmatched) {
        const which =
          candidates.length === 0 ? "no paint" : candidates.join(", ");
        console.log(`  "${key}": ${which}`);
      }
    }
  }
  if (differences.length > 0) {
    console.log(
      "\nChanged in the source, kept in the curated paints (decide by hand):",
    );
    for (const d of differences) {
      console.log(
        `  ${d.paintId} ${d.field}: source ${String(d.source)}, curated ${String(d.curated)}`,
      );
    }
  }
  if (pending.length > 0) {
    console.log("\nThe builder will reject these until they are decided:");
    printIssues(pending);
  }
  console.log("\nNext: pnpm format, then build-catalog, and review the diff.");
  return 0;
}
