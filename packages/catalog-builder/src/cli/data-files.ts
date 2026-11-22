/**
 * Locations of the curated data, of `catalog.json` and of the discrepancy
 * report (docs/04 §2 and §6), and the reading of those files shared by the
 * entry points.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { err, ok, type Result } from "@chromatic-wheel/domain";
import type { DataIssue, RawFile } from "../curated/files.ts";
import type { CuratedData } from "../pipeline/build-catalog.ts";

const PACKAGE_DIR = resolve(import.meta.dirname, "../..");
export const REPO_DIR = resolve(PACKAGE_DIR, "../..");
const DATA_DIR = join(PACKAGE_DIR, "data");
export const SOURCES_DIR = "sources";
export const BRANDS_DIR = "brands";
export const TOMBSTONES_FILE = "tombstones.json";
const IGNORE_REASONS_FILE = "ignore-reasons.json";
const COLOR_POLICY_FILE = "color-policy.json";
export const OUTPUT_FILE = join(REPO_DIR, "apps/web/public/catalog.json");
/** The colour discrepancies between sources (docs/04 §6, step 9). */
export const DISCREPANCIES_FILE = join(
  PACKAGE_DIR,
  "reports/color-discrepancies.json",
);

export const fromRepo = (path: string): string => relative(REPO_DIR, path);

/** A data file, by its name relative to `data/`, as seen from the repo. */
export const dataPath = (name: string): string =>
  fromRepo(join(DATA_DIR, name));

/** Prints the issues found in the data files, each at its file. */
export function printIssues(issues: readonly DataIssue[]): void {
  for (const issue of issues) {
    const at = issue.path === "" ? "" : ` ${issue.path}`;
    console.error(`${dataPath(issue.file)}${at}: ${issue.message}`);
  }
}

export interface CuratedFiles {
  readonly tombstones: RawFile;
  readonly data: CuratedData;
}

/**
 * Reads every curated file, in alphabetical order so the run does not depend
 * on the file system. On failure, returns the messages to show.
 */
export async function readCuratedFiles(): Promise<
  Result<CuratedFiles, readonly string[]>
> {
  const inDir = async (dir: string): Promise<string[]> =>
    (await readdir(join(DATA_DIR, dir)))
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => `${dir}/${name}`);
  const [sourceNames, brandNames] = await Promise.all([
    inDir(SOURCES_DIR),
    inDir(BRANDS_DIR),
  ]);
  const [tombstones, ignoreReasons, colorPolicy, ...rest] = await Promise.all(
    [
      TOMBSTONES_FILE,
      IGNORE_REASONS_FILE,
      COLOR_POLICY_FILE,
      ...sourceNames,
      ...brandNames,
    ].map(readDataFile),
  );
  const files = [tombstones, ignoreReasons, colorPolicy, ...rest];
  const unreadable = files.filter((file) => typeof file === "string");
  if (unreadable.length > 0) return err(unreadable);
  const read = files.filter(
    (file): file is RawFile => typeof file !== "string",
  );
  const [t, i, c] = read;
  if (t === undefined || i === undefined || c === undefined) {
    throw new Error("Unreachable: a fixed data file was not read");
  }
  return ok({
    tombstones: t,
    data: {
      ignoreReasons: i,
      colorPolicy: c,
      sources: read.slice(3, 3 + sourceNames.length),
      brands: read.slice(3 + sourceNames.length),
    },
  });
}

/**
 * Reads a data file by its name relative to `data/`, which is also the name
 * the pipeline reports issues with. On failure, returns the message to show.
 */
export async function readDataFile(name: string): Promise<RawFile | string> {
  const path = join(DATA_DIR, name);
  try {
    const content: unknown = JSON.parse(await readFile(path, "utf8"));
    return { name, content };
  } catch (error) {
    return `${fromRepo(path)}: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/** Writes a data file as JSON; `pnpm format` gives it its final layout. */
export async function writeDataFile(
  name: string,
  content: unknown,
): Promise<void> {
  await writeFile(
    join(DATA_DIR, name),
    `${JSON.stringify(content, null, 2)}\n`,
    "utf8",
  );
}
