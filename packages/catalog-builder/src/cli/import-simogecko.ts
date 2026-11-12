/**
 * Imports the Citadel paints from the SimoGecko/CitadelColours table into
 * `data/brands/citadel.json` (docs/04 §4). Run on demand, never in the CI:
 *
 *   pnpm --filter @rueda-cromatica/catalog-builder import-simogecko
 *
 * The table is fetched at the commit pinned in the source's `url`, so a new
 * revision is taken by changing that URL in `sources.json`.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readBrandFile, readSourcesFile } from "../curated/files.ts";
import { mergePaints } from "../importers/merge.ts";
import { importSimoGecko } from "../importers/simogecko.ts";
import { BRANDS_DIR, fromRepo, readJson, SOURCES_FILE } from "./data-files.ts";

const SOURCE_ID = "simogecko-citadel-colours";
const BRAND_FILE = join(BRANDS_DIR, "citadel.json");
const BLOB_URL =
  /^https:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/([0-9a-f]{40})\/(.+)$/;

function fail(messages: readonly string[]): number {
  for (const message of messages) console.error(message);
  return 1;
}

async function main(): Promise<number> {
  const sourcesFile = await readJson(SOURCES_FILE);
  const brandFile = await readJson(BRAND_FILE);
  if (typeof sourcesFile === "string") return fail([sourcesFile]);
  if (typeof brandFile === "string") return fail([brandFile]);

  const sources = readSourcesFile(sourcesFile);
  if (!sources.ok)
    return fail(sources.error.map((i) => `${i.path}: ${i.message}`));
  const source = sources.value.find((s) => s.id === SOURCE_ID);
  const match = BLOB_URL.exec(source?.url ?? "");
  if (match === null) {
    return fail([
      `${fromRepo(SOURCES_FILE)}: ${SOURCE_ID} needs a GitHub URL pinned to a commit`,
    ]);
  }
  const [, repo = "", commit = "", path = ""] = match;

  const current = readBrandFile(brandFile);
  if (!current.ok) {
    return fail(current.error.map((i) => `${i.file} ${i.path}: ${i.message}`));
  }

  const response = await fetch(
    `https://raw.githubusercontent.com/${repo}/${commit}/${path}`,
  );
  if (!response.ok) {
    return fail([`Could not fetch the table: HTTP ${String(response.status)}`]);
  }

  const imported = importSimoGecko(await response.text(), SOURCE_ID);
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
  await writeFile(BRAND_FILE, `${JSON.stringify(content, null, 2)}\n`, "utf8");

  console.log(
    `${fromRepo(BRAND_FILE)}: ${String(merged.value.paints.length)} paints`,
  );
  if (merged.value.missing.length > 0) {
    console.log("\nNo longer in the source (kept, decide by hand):");
    for (const paint of merged.value.missing) console.log(`  ${paint.id}`);
  }
  console.log("\nNext: pnpm format, then build-catalog, and review the diff.");
  return 0;
}

process.exitCode = await main();
