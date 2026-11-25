import {
  buildCatalog,
  catalogIds,
  checkIdStability,
  formatStabilityIssues,
  readCurated,
  readTombstonesFile,
  type BuiltCatalog,
  type DataIssue,
} from "@chromatic-wheel/catalog-builder";
import { err, ok, type Result } from "@chromatic-wheel/domain";
import { Injectable } from "@nestjs/common";
import { DraftService } from "./draft.service.ts";
import { PublicationsService } from "./publications.service.ts";

/** Why the draft does not give a catalog that can be published. */
export type BuildFailure =
  /** The checks of `build-catalog` (docs/04 §6), each at its data file. */
  | { readonly kind: "data"; readonly issues: readonly DataIssue[] }
  /** The ID stability against the latest publication (docs/03 §7). */
  | { readonly kind: "unstable-ids"; readonly report: string }
  /** The latest publication cannot be read. */
  | { readonly kind: "publication"; readonly message: string };

/**
 * Generates the catalog from the draft with the pure logic of
 * `catalog-builder`, as `build-catalog` does from `data/`, and checks its
 * IDs against the latest publication (ADR-0043). The preview and «Publicar»
 * of session 7 start here.
 */
@Injectable()
export class CatalogBuildService {
  constructor(
    private readonly draft: DraftService,
    private readonly publications: PublicationsService,
  ) {}

  async build(): Promise<Result<BuiltCatalog, BuildFailure>> {
    const files = await this.draft.read();
    const tombstones = readTombstonesFile(files.tombstones);
    const curated = readCurated(files.data);
    const built = curated.ok ? buildCatalog(curated.value) : curated;
    if (!tombstones.ok || !built.ok) {
      return err({
        kind: "data",
        issues: [
          ...(tombstones.ok ? [] : tombstones.error),
          ...(built.ok ? [] : built.error),
        ],
      });
    }

    const published = await this.publications.latestIds();
    if (!published.ok) {
      return err({ kind: "publication", message: published.error });
    }
    const current = catalogIds(built.value.document);
    if (!current.ok) throw new Error(`Builder bug: ${current.error}`);
    const unstable = checkIdStability({
      current: current.value,
      tombstones: tombstones.value,
      published: published.value,
      disabledSources: new Set(built.value.disabledSources.disabledSources),
    });
    if (unstable.length > 0) {
      return err({
        kind: "unstable-ids",
        report: formatStabilityIssues(unstable, {
          published: published.value?.label ?? null,
          tombstonesFile: files.tombstones.name,
        }),
      });
    }
    return ok(built.value);
  }
}
