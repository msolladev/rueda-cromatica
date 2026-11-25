/**
 * The catalog data of the repository, for the commands that read it: the
 * curated files of `data/` and the catalog of the latest release tag, which
 * needs the history and the tags of git (docs/09 §8.3). It goes away with
 * `data/` (ADR-0037).
 */
import {
  readCuratedFiles,
  readReleaseCatalog,
} from "@chromatic-wheel/catalog-builder/data";
import { err, ok, type Result } from "@chromatic-wheel/domain";
import type { CatalogPack } from "../features/catalog/catalog-pack.ts";

/** The data of the repository, or the messages to show. */
export async function readCatalogPack(): Promise<
  Result<CatalogPack, readonly string[]>
> {
  const [files, release] = await Promise.all([
    readCuratedFiles(),
    readReleaseCatalog(),
  ]);
  if (!files.ok || !release.ok) {
    return err([
      ...(files.ok ? [] : files.error),
      ...(release.ok ? [] : release.error),
    ]);
  }
  return ok({ files: files.value, release: release.value });
}
