/**
 * What the integration tests of the catalog prepare (docs/09 §8): the data of
 * `data/` and of the latest release tag, loaded into the database of the
 * tests from a clean start, with no publications.
 */
import {
  readCuratedFiles,
  readReleaseCatalog,
  type CuratedFiles,
  type ReleaseCatalog,
} from "@chromatic-wheel/catalog-builder/data";
import type { INestApplicationContext } from "@nestjs/common";
import { PrismaService } from "../src/core/database/prisma.service.ts";
import {
  LoadCatalogService,
  type Loaded,
} from "../src/features/catalog/load-catalog.service.ts";

/** The curated files and the catalog of the latest release. */
export interface CatalogData {
  readonly files: CuratedFiles;
  readonly release: ReleaseCatalog;
}

/** Reads `data/` and the latest release tag, which the tests need. */
export async function readCatalogData(): Promise<CatalogData> {
  const [files, release] = await Promise.all([
    readCuratedFiles(),
    readReleaseCatalog(),
  ]);
  if (!files.ok || !release.ok || release.value === null) {
    throw new Error("The tests need data/ and a release tag");
  }
  return { files: files.value, release: release.value };
}

/** Deletes every publication, which only the tests may do. */
export async function clearPublications(
  app: INestApplicationContext,
): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.publicationCatalog.deleteMany();
  await prisma.publication.deleteMany();
}

/** Loads the data, failing the test if the load fails. */
export async function loadCatalog(
  app: INestApplicationContext,
  { files, release }: CatalogData,
): Promise<Loaded> {
  const loaded = await app.get(LoadCatalogService).load(files, release);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  return loaded.value;
}

/**
 * Reads the data and loads it from a clean start: without publications, so
 * that the latest release becomes the first one.
 */
export async function prepareCatalog(
  app: INestApplicationContext,
): Promise<CatalogData> {
  const data = await readCatalogData();
  await clearPublications(app);
  await loadCatalog(app, data);
  return data;
}
