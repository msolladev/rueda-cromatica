/**
 * Entry point of the builder (docs/04 §3). Reads the curated files, runs the
 * pure pipeline and writes `catalog.json`. With `--check` it writes nothing
 * and fails if the versioned file is out of date (ADR-0011, CI step 4).
 *
 *   pnpm --filter @rueda-cromatica/catalog-builder build-catalog [--check]
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import type { RawFile } from "../curated/files.ts";
import { buildCatalog } from "../pipeline/build-catalog.ts";

const PACKAGE_DIR = resolve(import.meta.dirname, "../..");
const REPO_DIR = resolve(PACKAGE_DIR, "../..");
const DATA_DIR = join(PACKAGE_DIR, "data");
const SOURCES_FILE = join(DATA_DIR, "sources.json");
const BRANDS_DIR = join(DATA_DIR, "brands");
const OUTPUT_FILE = join(REPO_DIR, "apps/web/public/catalog.json");

const fromRepo = (path: string): string => relative(REPO_DIR, path);

/** Files are named by their base name, as the pipeline checks brand files. */
async function readJson(path: string): Promise<RawFile | string> {
  try {
    const content: unknown = JSON.parse(await readFile(path, "utf8"));
    return { name: basename(path), content };
  } catch (error) {
    return `${fromRepo(path)}: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function main(check: boolean): Promise<number> {
  // Alphabetical order, so the run does not depend on the file system.
  const brandNames = (await readdir(BRANDS_DIR))
    .filter((name) => name.endsWith(".json"))
    .sort();
  const paths = [SOURCES_FILE, ...brandNames.map((n) => join(BRANDS_DIR, n))];
  const pathOf = new Map(paths.map((path) => [basename(path), path]));
  const files = await Promise.all(paths.map(readJson));

  const unreadable = files.filter((file) => typeof file === "string");
  if (unreadable.length > 0) {
    for (const message of unreadable) console.error(message);
    return 1;
  }
  const [sources, ...brands] = files.filter((file) => typeof file !== "string");
  if (sources === undefined) throw new Error("Unreachable: sources not read");

  const result = buildCatalog({ sources, brands });
  if (!result.ok) {
    for (const issue of result.error) {
      const file = pathOf.get(issue.file) ?? issue.file;
      console.error(`${fromRepo(file)} ${issue.path}: ${issue.message}`);
    }
    console.error(
      `\n${String(result.error.length)} issue(s); nothing written.`,
    );
    return 1;
  }

  const output = fromRepo(OUTPUT_FILE);
  if (check) {
    const current = await readFile(OUTPUT_FILE, "utf8").catch(() => null);
    if (current !== result.value.json) {
      console.error(
        `${output} is out of date. Run: pnpm --filter @rueda-cromatica/catalog-builder build-catalog`,
      );
      return 1;
    }
    console.log(`${output} is up to date.`);
    return 0;
  }

  await mkdir(dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, result.value.json, "utf8");
  const { meta, paints } = result.value.document;
  console.log(
    `${output}: ${String(paints.length)} paints, ${meta.dataVersion}`,
  );
  return 0;
}

process.exitCode = await main(process.argv.includes("--check"));
