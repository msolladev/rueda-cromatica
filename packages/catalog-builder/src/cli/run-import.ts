/**
 * Flow shared by the importer entry points (docs/04 §7): fetches the source
 * at the commit pinned in its file, transcribes it, reconciles it with the
 * curated paints and writes the source file and the proposed paints. The
 * importer logic itself stays pure.
 */
import type { Result, SourceId } from "@chromatic-wheel/domain";
import {
  readBrandFile,
  readCurated,
  readSourceFile,
  type SourceFile,
  type SourceFileContent,
  type SourceRow,
} from "../curated/files.ts";
import { reconcile, type ProposalRules } from "../importers/reconcile.ts";
import {
  dataPath,
  printIssues,
  readCuratedFiles,
  writeDataFile,
} from "./data-files.ts";

/** A GitHub URL pinned to a commit: `…/blob/<sha>/<path>` or `…/tree/<sha>`. */
export interface PinnedGitHub {
  readonly repo: string;
  readonly commit: string;
  readonly path: string;
}

const PINNED_URL =
  /^https:\/\/github\.com\/([^/]+\/[^/]+)\/(?:blob|tree)\/([0-9a-f]{40})(?:\/(.*))?$/;

export const rawUrl = (pinned: PinnedGitHub, path = pinned.path): string =>
  `https://raw.githubusercontent.com/${pinned.repo}/${pinned.commit}/${path}`;

export interface ImportOptions {
  readonly sourceId: SourceId;
  /** The raw files to fetch, from the pinned URL of the source. */
  readonly fileUrls: (pinned: PinnedGitHub) => readonly string[];
  readonly transcribe: (
    files: readonly { readonly name: string; readonly text: string }[],
  ) => Result<readonly SourceRow[], readonly string[]>;
  readonly rules: ProposalRules;
}

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
  const match = PINNED_URL.exec(source.source.url ?? "");
  if (match === null) {
    return fail([
      `${dataPath(source.name)}: ${options.sourceId} needs a GitHub URL pinned to a commit`,
    ]);
  }
  const [, repo = "", commit = "", path = ""] = match;

  const fetched: { name: string; text: string }[] = [];
  for (const url of options.fileUrls({ repo, commit, path })) {
    const response = await fetch(url);
    if (!response.ok) {
      return fail([`Could not fetch ${url}: HTTP ${String(response.status)}`]);
    }
    fetched.push({ name: url, text: await response.text() });
  }
  const rows = options.transcribe(fetched);
  if (!rows.ok) return fail(rows.error);

  const result = reconcile({
    current: curated.value,
    sourceId: options.sourceId,
    rows: rows.value,
    rules: options.rules,
  });
  if (!result.ok) return fail(result.error);
  const { proposals, differences, pending } = result.value;

  // Never write a file that does not pass its own checks.
  const sourceFile: SourceFile = { ...source, paints: rows.value };
  const writes: { name: string; content: unknown }[] = [
    { name: source.name, content: sourceContent(sourceFile) },
  ];
  for (const brand of result.value.brands) {
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
    `${dataPath(source.name)}: ${String(rows.value.length)} rows, ${String(proposals.length)} new paint(s)`,
  );
  for (const paint of proposals) console.log(`  + ${paint.id}`);
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

/** The content of a source file, in the order of its schema. */
function sourceContent(file: SourceFile): SourceFileContent {
  return {
    source: file.source,
    paints: file.paints,
    ignoredGroups: file.ignoredGroups,
    ignoredKeys: file.ignoredKeys,
  };
}
