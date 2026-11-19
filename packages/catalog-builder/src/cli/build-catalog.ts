/**
 * Entry point of the builder (docs/04 §3). Reads the curated files, runs the
 * pure pipeline, checks the ID stability against the latest release (docs/03
 * §7) and writes `catalog.json`. With `--check` it writes nothing and fails if
 * the versioned file is out of date (ADR-0011, CI step 4).
 *
 *   pnpm --filter @chromatic-wheel/catalog-builder build-catalog [--check]
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { readTombstonesFile } from "../curated/files.ts";
import { buildCatalog } from "../pipeline/build-catalog.ts";
import {
  catalogIds,
  checkIdStability,
  formatStabilityIssues,
} from "../pipeline/id-stability.ts";
import {
  BRANDS_DIR,
  fromRepo,
  OUTPUT_FILE,
  readJson,
  SOURCES_FILE,
  TOMBSTONES_FILE,
} from "./data-files.ts";
import { readPublishedCatalog } from "./published-catalog.ts";

async function main(check: boolean): Promise<number> {
  // Alphabetical order, so the run does not depend on the file system.
  const brandNames = (await readdir(BRANDS_DIR))
    .filter((name) => name.endsWith(".json"))
    .sort();
  const paths = [
    TOMBSTONES_FILE,
    SOURCES_FILE,
    ...brandNames.map((n) => join(BRANDS_DIR, n)),
  ];
  const pathOf = new Map(paths.map((path) => [basename(path), path]));
  const files = await Promise.all(paths.map(readJson));

  const unreadable = files.filter((file) => typeof file === "string");
  if (unreadable.length > 0) {
    for (const message of unreadable) console.error(message);
    return 1;
  }
  const [tombstonesFile, sources, ...brands] = files.filter(
    (file) => typeof file !== "string",
  );
  if (tombstonesFile === undefined || sources === undefined) {
    throw new Error("Unreachable: tombstones or sources not read");
  }

  const tombstones = readTombstonesFile(tombstonesFile);
  const result = buildCatalog({ sources, brands });
  const issues = [
    ...(tombstones.ok ? [] : tombstones.error),
    ...(result.ok ? [] : result.error),
  ];
  if (!tombstones.ok || !result.ok) {
    for (const issue of issues) {
      const file = pathOf.get(issue.file) ?? issue.file;
      console.error(`${fromRepo(file)} ${issue.path}: ${issue.message}`);
    }
    console.error(`\n${String(issues.length)} issue(s); nothing written.`);
    return 1;
  }

  // ID stability (docs/03 §7), before anything is written or compared.
  const published = await readPublishedCatalog();
  if (!published.ok) {
    for (const message of published.error) console.error(message);
    return 1;
  }
  const current = catalogIds(result.value.document);
  if (!current.ok) throw new Error(`Builder bug: ${current.error}`);
  const unstable = checkIdStability({
    current: current.value,
    tombstones: tombstones.value,
    published: published.value,
  });
  const release = published.value?.release ?? null;
  if (unstable.length > 0) {
    const report = formatStabilityIssues(unstable, {
      release,
      tombstonesFile: fromRepo(TOMBSTONES_FILE),
    });
    console.error(report);
    console.error(`\n${String(unstable.length)} issue(s); nothing written.`);
    return 1;
  }
  console.log(
    release === null
      ? "IDs stable: no release yet, only the tombstones were checked."
      : `IDs stable against ${release}.`,
  );

  const output = fromRepo(OUTPUT_FILE);
  if (check) {
    const current = await readFile(OUTPUT_FILE, "utf8").catch(() => null);
    if (current !== result.value.json) {
      console.error(
        `${output} is out of date. Run: pnpm --filter @chromatic-wheel/catalog-builder build-catalog`,
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
