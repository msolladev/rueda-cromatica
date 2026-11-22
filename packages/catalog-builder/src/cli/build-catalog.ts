/**
 * Entry point of the builder (docs/04 §6). Reads the curated files, runs the
 * pure pipeline, checks the ID stability against the latest release (docs/03
 * §7) and writes `catalog.json`. With `--check` it writes nothing and fails if
 * the versioned file is out of date (ADR-0011, CI step 4).
 *
 *   pnpm --filter @chromatic-wheel/catalog-builder build-catalog [--check]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { readTombstonesFile } from "../curated/files.ts";
import { buildCatalog } from "../pipeline/build-catalog.ts";
import {
  catalogIds,
  checkIdStability,
  formatStabilityIssues,
} from "../pipeline/id-stability.ts";
import {
  dataPath,
  fromRepo,
  OUTPUT_FILE,
  printIssues,
  readCuratedFiles,
  TOMBSTONES_FILE,
} from "./data-files.ts";
import { readPublishedCatalog } from "./published-catalog.ts";

async function main(check: boolean): Promise<number> {
  const files = await readCuratedFiles();
  if (!files.ok) {
    for (const message of files.error) console.error(message);
    return 1;
  }

  const tombstones = readTombstonesFile(files.value.tombstones);
  const result = buildCatalog(files.value.data);
  const issues = [
    ...(tombstones.ok ? [] : tombstones.error),
    ...(result.ok ? [] : result.error),
  ];
  if (!tombstones.ok || !result.ok) {
    printIssues(issues);
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
      tombstonesFile: dataPath(TOMBSTONES_FILE),
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
