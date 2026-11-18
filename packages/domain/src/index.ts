export { err, ok, type Result } from "./result.ts";

export * from "./catalog/schema.ts";
export type { Catalog, PaintQuery } from "./catalog/catalog.ts";
export {
  compareSortKeys,
  edgeSortKey,
  idSortKey,
  type CatalogIssue,
} from "./catalog/integrity.ts";
export {
  formatPath,
  parseCatalog,
  type CatalogParseError,
} from "./catalog/parse.ts";
export { isColorApproximate, resolveReplacement } from "./catalog/rules.ts";

export {
  compareMatches,
  DEFAULT_LIMIT,
  DEFAULT_PAINT_TYPES,
  findClosestPaints,
  rankOverall,
  type BrandMatches,
  type CalculatedMatch,
  type ClosestPaints,
  type MatchingError,
  type MatchOptions,
} from "./matching/closest-paints.ts";
export { buildPaintIndex, type PaintIndex } from "./matching/paint-index.ts";
export {
  MATCH_QUALITY_LIMITS,
  matchQuality,
  type MatchQuality,
} from "./matching/quality.ts";
