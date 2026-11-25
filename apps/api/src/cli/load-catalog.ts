/**
 * Loads the curated data of `data/` into the draft of the database, and the
 * catalog of the latest release tag as the first publication, if there is
 * none (ADR-0043). It can be repeated. It goes away with `data/` (ADR-0037).
 *
 *   pnpm --filter @chromatic-wheel/api catalog:load
 *
 * With `--from`, it loads a catalog pack instead (`catalog:pack`), as the
 * deploy does in each environment, which has neither `data/` nor git
 * (docs/08):
 *
 *   node dist/cli/load-catalog.js --from catalog-pack.json
 */
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { printIssues } from "@chromatic-wheel/catalog-builder/data";
import { err, type Result } from "@chromatic-wheel/domain";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module.ts";
import {
  parseCatalogPack,
  type CatalogPack,
} from "../features/catalog/catalog-pack.ts";
import { LoadCatalogService } from "../features/catalog/load-catalog.service.ts";
import { readCatalogPack } from "./catalog-data.ts";

/** The pack of `--from`, or the one read from `data/` and git. */
async function readPack(
  from: string | undefined,
): Promise<Result<CatalogPack, readonly string[]>> {
  if (from === undefined) return readCatalogPack();
  const pack = parseCatalogPack(await readFile(from, "utf8"));
  return pack.ok ? pack : err([`${from}: ${pack.error}`]);
}

async function main(): Promise<number> {
  const { values } = parseArgs({ options: { from: { type: "string" } } });
  const read = await readPack(values.from);
  if (!read.ok) {
    for (const message of read.error) console.error(message);
    return 1;
  }
  const pack = read.value;

  // NestJS without its HTTP server, for a command (docs/09 §6).
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const loaded = await app
      .get(LoadCatalogService)
      .load(pack.files, pack.release);
    if (!loaded.ok) {
      if (loaded.error.kind === "release") {
        console.error(loaded.error.message);
      } else {
        printIssues(loaded.error.issues);
      }
      return 1;
    }
    const { sources, brands, paints, publication } = loaded.value;
    console.log(
      `Draft loaded: ${String(sources)} sources, ${String(brands)} brands, ${String(paints)} paints.`,
    );
    console.log(
      {
        added: `First publication stored: ${pack.release?.tag ?? ""}.`,
        kept: "Publications kept: there already is one.",
        "no-release": "No release tag yet, so no publication.",
      }[publication],
    );
    return 0;
  } finally {
    await app.close();
  }
}

process.exitCode = await main();
