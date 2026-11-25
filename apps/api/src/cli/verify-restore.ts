/**
 * Checks a backup restored into a temporary database (docs/08 §8): that its
 * latest publication is, byte for byte, the same publication in the live
 * database, found by its UUID, so that one published after the backup does
 * not matter; and that its draft generates a catalog that can be published,
 * with its IDs checked against that publication. The draft is not compared
 * with the publication: their difference is what is pending (ADR-0043).
 *
 *   DATABASE_URL=<restored> LIVE_DATABASE_URL=<live> node dist/cli/verify-restore.js
 *
 * Both URLs take the password of DATABASE_PASSWORD_FILE, if it is set.
 */
import { printIssues } from "@chromatic-wheel/catalog-builder/data";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module.ts";
import { CatalogBuildService } from "../features/catalog/catalog-build.service.ts";
import {
  PublicationsService,
  type StoredPublication,
} from "../features/catalog/publications.service.ts";

/** Runs a task with NestJS, without its HTTP server, on a database. */
async function withDatabase<T>(
  url: string,
  task: (
    app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>,
  ) => Promise<T>,
): Promise<T> {
  process.env["DATABASE_URL"] = url;
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    return await task(app);
  } finally {
    await app.close();
  }
}

async function main(): Promise<number> {
  const restoredUrl = process.env["DATABASE_URL"];
  const liveUrl = process.env["LIVE_DATABASE_URL"];
  if (restoredUrl === undefined || liveUrl === undefined) {
    console.error("DATABASE_URL and LIVE_DATABASE_URL are required");
    return 2;
  }

  const restored = await withDatabase(restoredUrl, async (app) => ({
    publication: await app.get(PublicationsService).stored("latest"),
    built: await app.get(CatalogBuildService).build(),
  }));
  if (restored.publication === null) {
    console.error("FAIL  the restored backup has no publication");
    return 1;
  }
  const { uuid } = restored.publication;
  const live: StoredPublication | null = await withDatabase(liveUrl, (app) =>
    app.get(PublicationsService).stored({ uuid }),
  );

  let failures = 0;
  if (JSON.stringify(live) !== JSON.stringify(restored.publication)) {
    console.error(
      `FAIL  publication ${uuid}: ${live === null ? "missing in" : "different from"} the live database`,
    );
    failures += 1;
  } else {
    console.log(`ok    publication ${uuid}: the same as the live one`);
  }
  if (!restored.built.ok) {
    const failure = restored.built.error;
    console.error("FAIL  the restored draft does not generate a catalog:");
    if (failure.kind === "data") printIssues(failure.issues);
    else
      console.error(
        failure.kind === "unstable-ids" ? failure.report : failure.message,
      );
    failures += 1;
  } else {
    console.log(
      `ok    the restored draft generates a catalog of ${String(restored.built.value.document.paints.length)} paints`,
    );
  }
  return failures === 0 ? 0 : 1;
}

process.exitCode = await main();
