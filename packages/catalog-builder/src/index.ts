/**
 * Public API of `@chromatic-wheel/catalog-builder` (ADR-0037): the pure logic
 * of the catalog, with nothing that reads or writes files, fetches, reads a
 * PDF or runs git. Whoever uses it reads the data and the sources and stores
 * the results: today the CLI of `src/cli/`, which only uses what is exported
 * here; in phase 6, `apps/api`.
 */

// The model of the curated data (docs/04 §2-5).
export {
  sourceContent,
  type BrandFile,
  type BrandFileContent,
  type ColorPolicy,
  type Curated,
  type CuratedPaint,
  type DataIssue,
  type IdCollection,
  type IgnoreReason,
  type PathIssue,
  type SourceDownload,
  type SourceFile,
  type SourceFileContent,
  type SourceRow,
  type Tombstones,
} from "./model/curated.ts";

// The curated data as the files of `data/`, until the migration (ADR-0037).
export {
  readBrandFile,
  readCurated,
  readSourceFile,
  readTombstonesFile,
  type CuratedData,
  type FileResult,
  type RawFile,
} from "./curated/files.ts";

// The catalog, its reports and the stability of its IDs (docs/04 §6).
export { buildCatalog, type BuiltCatalog } from "./pipeline/build-catalog.ts";
export {
  formatDisabledSources,
  type DisabledSourcesReport,
} from "./pipeline/disabled-sources.ts";
export type { Discrepancy } from "./pipeline/discrepancies.ts";
export {
  catalogIds,
  checkIdStability,
  formatStabilityIssues,
  latestRelease,
  nextRelease,
  RELEASE_TAG_PREFIX,
  type CatalogIds,
  type PublishedCatalog,
  type StabilityIssue,
} from "./pipeline/id-stability.ts";

// The importers (docs/04 §7).
export type { Transcription } from "./importers/chart.ts";
export type { KeyProposals } from "./importers/chart-keys.ts";
export {
  importSource,
  type ImportInput,
  type Imported,
} from "./importers/import-source.ts";
export type { PdfPage, PdfText, PdfTextItem } from "./importers/pdf-text.ts";
export type { Difference } from "./importers/reconcile.ts";
export {
  importerOf,
  type SourceImporter,
  type TextFile,
  type Transcribed,
} from "./importers/registry.ts";
export { sourceFiles } from "./importers/source-files.ts";

// The pure part of `archive-sources` (docs/04 §9).
export {
  applyArchive,
  captureUrl,
  cdxQuery,
  describeRequestFailure,
  parseCdx,
  parseIaConfig,
  parseJobStatus,
  parseSaveAnswer,
  planArchive,
  retryWait,
  s3Authorization,
  saveRequest,
  sha256,
  statusRequest,
  WAYBACK_GAP_MS,
  type ArchivePlan,
  type CaptureFailure,
  type DownloadTarget,
  type JobStatus,
  type RequestFailure,
} from "./archive/archive-sources.ts";
