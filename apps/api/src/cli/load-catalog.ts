/**
 * Loads the curated data of `data/` into the draft of the database, and the
 * catalog of the latest release tag as the first publication, if there is
 * none (ADR-0043). It can be repeated. It goes away with `data/` (ADR-0037).
 *
 *   pnpm --filter @chromatic-wheel/api catalog:load
 */
import {
  printIssues,
  readCuratedFiles,
  readReleaseCatalog,
} from "@chromatic-wheel/catalog-builder/data";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module.ts";
import { LoadCatalogService } from "../features/catalog/load-catalog.service.ts";

async function main(): Promise<number> {
  const [files, release] = await Promise.all([
    readCuratedFiles(),
    readReleaseCatalog(),
  ]);
  if (!files.ok || !release.ok) {
    for (const message of [
      ...(files.ok ? [] : files.error),
      ...(release.ok ? [] : release.error),
    ]) {
      console.error(message);
    }
    return 1;
  }

  // NestJS without its HTTP server, for a command (docs/09 §6).
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const loaded = await app
      .get(LoadCatalogService)
      .load(files.value, release.value);
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
        added: `First publication stored: ${release.value?.tag ?? ""}.`,
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
