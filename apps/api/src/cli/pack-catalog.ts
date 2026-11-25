/**
 * Writes the catalog pack (docs/09 §8.3): the curated files of `data/` and
 * the catalog of the latest release tag, in one file that the deploy loads
 * with `catalog:load --from` in each environment, which has neither `data/`
 * nor git (docs/08). It goes away with `data/` (ADR-0037).
 *
 *   pnpm --filter @chromatic-wheel/api catalog:pack <file>
 */
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { formatCatalogPack } from "../features/catalog/catalog-pack.ts";
import { readCatalogPack } from "./catalog-data.ts";

async function main(): Promise<number> {
  const { positionals } = parseArgs({ allowPositionals: true });
  const [file] = positionals;
  if (file === undefined || positionals.length > 1) {
    console.error("usage: catalog:pack <file>");
    return 2;
  }
  const pack = await readCatalogPack();
  if (!pack.ok) {
    for (const message of pack.error) console.error(message);
    return 1;
  }
  // pnpm runs the script in the package's folder, not in the caller's.
  const path = resolve(process.env["INIT_CWD"] ?? ".", file);
  await writeFile(path, formatCatalogPack(pack.value));
  console.log(`Catalog pack written: ${path}`);
  return 0;
}

process.exitCode = await main();
