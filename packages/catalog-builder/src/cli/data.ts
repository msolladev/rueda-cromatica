/**
 * The entry `@chromatic-wheel/catalog-builder/data`: the reading of the
 * curated files of `data/` and of the catalog of the latest release tag, for
 * `apps/api` to load them into its database (ADR-0043). Apart from the pure
 * API of `src/index.ts`, because it reads the disk and runs git. It goes away
 * with `data/` after the migration (ADR-0037).
 */
export {
  printIssues,
  readCuratedFiles,
  type CuratedFiles,
} from "./data-files.ts";
export {
  readReleaseCatalog,
  type ReleaseCatalog,
} from "./published-catalog.ts";
