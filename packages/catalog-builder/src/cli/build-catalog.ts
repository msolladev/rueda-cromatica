/**
 * Entry point of the builder (docs/04 §6). Reads the curated files, runs the
 * pure pipeline, checks the ID stability against the latest release (docs/03
 * §7) and writes `catalog.json`, the colour discrepancy report and the
 * summary of the disabled sources. With `--check` it writes nothing and fails
 * if any of those versioned files is out of date (ADR-0011, CI step 4).
 *
 *   pnpm --filter @chromatic-wheel/catalog-builder build-catalog [--check]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  buildCatalog,
  catalogIds,
  checkIdStability,
  formatDisabledSources,
  formatStabilityIssues,
  readCurated,
  readTombstonesFile,
} from "../index.ts";
import {
  dataPath,
  DISABLED_SOURCES_FILE,
  DISCREPANCIES_FILE,
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
  const curated = readCurated(files.value.data);
  const result = curated.ok ? buildCatalog(curated.value) : curated;
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
    disabledSources: new Set(result.value.disabledSources.disabledSources),
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

  const outputs = [
    { path: OUTPUT_FILE, content: result.value.json },
    { path: DISCREPANCIES_FILE, content: result.value.discrepanciesJson },
    {
      path: DISABLED_SOURCES_FILE,
      content: result.value.disabledSourcesJson,
    },
  ];
  for (const line of formatDisabledSources(result.value.disabledSources)) {
    console.log(line);
  }
  if (check) {
    let stale = 0;
    for (const { path, content } of outputs) {
      const current = await readFile(path, "utf8").catch(() => null);
      if (current === content) {
        console.log(`${fromRepo(path)} is up to date.`);
      } else {
        stale++;
        console.error(`${fromRepo(path)} is out of date.`);
      }
    }
    if (stale > 0) {
      console.error(
        "Run: pnpm --filter @chromatic-wheel/catalog-builder build-catalog",
      );
      return 1;
    }
    return 0;
  }

  for (const { path, content } of outputs) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
  }
  const { meta, paints } = result.value.document;
  console.log(
    `${fromRepo(OUTPUT_FILE)}: ${String(paints.length)} paints, ${meta.dataVersion}`,
  );
  console.log(
    `${fromRepo(DISCREPANCIES_FILE)}: ${String(result.value.discrepancies.length)} colour discrepancies`,
  );
  console.log(
    `${fromRepo(DISABLED_SOURCES_FILE)}: ${String(result.value.disabledSources.disabledSources.length)} disabled source(s)`,
  );
  return 0;
}

process.exitCode = await main(process.argv.includes("--check"));
