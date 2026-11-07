export type { Result } from "./result.ts";

export * from "./catalog/schema.ts";
export type { Catalog, PaintQuery } from "./catalog/catalog.ts";
export type { CatalogIssue } from "./catalog/integrity.ts";
export { parseCatalog, type CatalogParseError } from "./catalog/parse.ts";
export { isColorApproximate, resolveReplacement } from "./catalog/rules.ts";
