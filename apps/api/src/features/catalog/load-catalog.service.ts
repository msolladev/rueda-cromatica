import {
  readCurated,
  readTombstonesFile,
  type DataIssue,
} from "@chromatic-wheel/catalog-builder";
import type {
  CuratedFiles,
  ReleaseCatalog,
} from "@chromatic-wheel/catalog-builder/data";
import { err, ok, type Result } from "@chromatic-wheel/domain";
import { Injectable } from "@nestjs/common";
import { DraftService } from "./draft.service.ts";
import { PublicationsService } from "./publications.service.ts";

/** What a load did. */
export interface Loaded {
  readonly sources: number;
  readonly brands: number;
  readonly paints: number;
  /** Whether it stored the first publication, or there already was one. */
  readonly publication: "added" | "kept" | "no-release";
}

export type LoadFailure =
  | { readonly kind: "data"; readonly issues: readonly DataIssue[] }
  | { readonly kind: "release"; readonly message: string };

/**
 * The load from `data/` (ADR-0043), for development, the tests and the
 * migration of session 9. It can be repeated: it replaces the whole draft,
 * and only stores the first publication, from the latest release tag, while
 * there is none. It goes away with `data/` (ADR-0037).
 */
@Injectable()
export class LoadCatalogService {
  constructor(
    private readonly draft: DraftService,
    private readonly publications: PublicationsService,
  ) {}

  /**
   * Loads the curated files, already read, and the catalog of the latest
   * release, `null` before the first one. Each file is validated as
   * `build-catalog` does; the rules between files are checked when the
   * catalog is generated, as for any draft.
   */
  async load(
    files: CuratedFiles,
    release: ReleaseCatalog | null,
  ): Promise<Result<Loaded, LoadFailure>> {
    const tombstones = readTombstonesFile(files.tombstones);
    const curated = readCurated(files.data);
    if (!tombstones.ok || !curated.ok) {
      return err({
        kind: "data",
        issues: [
          ...(tombstones.ok ? [] : tombstones.error),
          ...(curated.ok ? [] : curated.error),
        ],
      });
    }

    await this.draft.replace(curated.value, tombstones.value);
    const { sources, brands } = curated.value;
    const counts = {
      sources: sources.length,
      brands: brands.length,
      paints: brands.reduce((sum, brand) => sum + brand.paints.length, 0),
    };
    if (release === null) return ok({ ...counts, publication: "no-release" });
    const publication = await this.publications.addFirst(release);
    return publication.ok
      ? ok({ ...counts, publication: publication.value })
      : err({ kind: "release", message: publication.error });
  }
}
