/**
 * Flow shared by the importer entry points (docs/04 §4): reads the source and
 * the brand file, fetches the source at its pinned commit, merges and writes
 * the brand file. The importer logic itself stays pure.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Result } from "@rueda-cromatica/domain";
import { readBrandFile, readSourcesFile } from "../curated/files.ts";
import { mergePaints, type ImportedPaint } from "../importers/merge.ts";
import { BRANDS_DIR, fromRepo, readJson, SOURCES_FILE } from "./data-files.ts";

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
  readonly sourceId: string;
  readonly brandId: string;
  /** The raw file to fetch, from the pinned URL of the source. */
  readonly fileUrl: (pinned: PinnedGitHub) => string;
  readonly read: (
    text: string,
    sourceId: string,
  ) => Result<readonly ImportedPaint[], readonly string[]>;
}

function fail(messages: readonly string[]): number {
  for (const message of messages) console.error(message);
  return 1;
}

export async function runImport(options: ImportOptions): Promise<number> {
  const brandPath = join(BRANDS_DIR, `${options.brandId}.json`);
  const sourcesFile = await readJson(SOURCES_FILE);
  const brandFile = await readJson(brandPath);
  if (typeof sourcesFile === "string") return fail([sourcesFile]);
  if (typeof brandFile === "string") return fail([brandFile]);

  const sources = readSourcesFile(sourcesFile);
  if (!sources.ok) {
    return fail(sources.error.map((i) => `${i.path}: ${i.message}`));
  }
  const source = sources.value.find((s) => s.id === options.sourceId);
  const match = PINNED_URL.exec(source?.url ?? "");
  if (match === null) {
    return fail([
      `${fromRepo(SOURCES_FILE)}: ${options.sourceId} needs a GitHub URL pinned to a commit`,
    ]);
  }
  const [, repo = "", commit = "", path = ""] = match;

  const current = readBrandFile(brandFile);
  if (!current.ok) {
    return fail(current.error.map((i) => `${i.file} ${i.path}: ${i.message}`));
  }

  const url = options.fileUrl({ repo, commit, path });
  const response = await fetch(url);
  if (!response.ok) {
    return fail([`Could not fetch ${url}: HTTP ${String(response.status)}`]);
  }

  const imported = options.read(await response.text(), options.sourceId);
  if (!imported.ok) return fail(imported.error);
  const merged = mergePaints(current.value.paints, imported.value);
  if (!merged.ok) return fail(merged.error);

  const content = {
    brand: current.value.brand,
    ranges: current.value.ranges,
    paints: merged.value.paints,
  };
  // Never write a file the builder would reject.
  const check = readBrandFile({ name: brandFile.name, content });
  if (!check.ok) {
    return fail(check.error.map((i) => `${i.file} ${i.path}: ${i.message}`));
  }
  await writeFile(brandPath, `${JSON.stringify(content, null, 2)}\n`, "utf8");

  console.log(
    `${fromRepo(brandPath)}: ${String(merged.value.paints.length)} paints`,
  );
  if (merged.value.missing.length > 0) {
    console.log("\nNo longer in the source (kept, decide by hand):");
    for (const paint of merged.value.missing) console.log(`  ${paint.id}`);
  }
  console.log("\nNext: pnpm format, then build-catalog, and review the diff.");
  return 0;
}
