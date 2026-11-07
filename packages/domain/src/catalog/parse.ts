/**
 * Loading contract of `catalog.json` (docs/02 §5): version check, structure,
 * integrity and construction. Expected failures are returned, never thrown.
 */
import { z } from "zod";
import { err, ok, type Result } from "../result.ts";
import { createCatalog, type Catalog } from "./catalog.ts";
import { checkIntegrity, type CatalogIssue } from "./integrity.ts";
import { catalogDocumentSchema, SUPPORTED_SCHEMA_VERSION } from "./schema.ts";

export type CatalogParseError =
  | {
      readonly kind: "unsupported-schema-version";
      readonly found: unknown;
      readonly supported: number;
    }
  | {
      readonly kind: "invalid-structure";
      readonly issues: readonly CatalogIssue[];
    }
  | { readonly kind: "integrity"; readonly issues: readonly CatalogIssue[] };

/**
 * Reads only `meta.schemaVersion`, so a newer document is not misreported.
 * Without that field the input is not a catalog of any version: the structure
 * check reports it, instead of suggesting an app update.
 */
const versionProbeSchema = z.object({
  meta: z.object({ schemaVersion: z.unknown() }),
});

export function parseCatalog(
  input: unknown,
): Result<Catalog, CatalogParseError> {
  const probe = versionProbeSchema.safeParse(input);
  const found = probe.success ? probe.data.meta.schemaVersion : undefined;
  if (found !== undefined && found !== SUPPORTED_SCHEMA_VERSION) {
    return err({
      kind: "unsupported-schema-version",
      found,
      supported: SUPPORTED_SCHEMA_VERSION,
    });
  }

  const structure = catalogDocumentSchema.safeParse(input);
  if (!structure.success) {
    return err({
      kind: "invalid-structure",
      issues: structure.error.issues.map((issue) => ({
        path: formatPath(issue.path),
        message: issue.message,
      })),
    });
  }

  const { issues, indexes } = checkIntegrity(structure.data);
  if (issues.length > 0) {
    return err({ kind: "integrity", issues });
  }

  return ok(createCatalog(structure.data, indexes));
}

/** `["paints", 12, "status"]` → `"paints[12].status"`. */
export function formatPath(path: readonly PropertyKey[]): string {
  return path
    .map((segment, i) =>
      typeof segment === "number"
        ? `[${String(segment)}]`
        : `${i === 0 ? "" : "."}${String(segment)}`,
    )
    .join("");
}
