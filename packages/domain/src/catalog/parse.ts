/**
 * Loading contract of `catalog.json` (docs/02 §5): version check, structure,
 * integrity and construction. Expected failures are returned, never thrown.
 */
import { z } from "zod";
import { err, ok, type Result } from "../result.ts";
import { createCatalog, type Catalog } from "./catalog.ts";
import { checkIntegrity, type CatalogIssue } from "./integrity.ts";
import { catalogDocumentSchema, SUPPORTED_SCHEMA_VERSION } from "./schema.ts";

/** Why {@link parseCatalog} rejected a catalog. */
export type CatalogParseError =
  | {
      /**
       * The catalog has a `meta.schemaVersion` that this package does not
       * read. The app needs an update, or the catalog is older.
       */
      readonly kind: "unsupported-schema-version";
      /** The version in the catalog. */
      readonly found: unknown;
      /** The version this package reads, {@link SUPPORTED_SCHEMA_VERSION}. */
      readonly supported: number;
    }
  | {
      /** The catalog does not have the structure of `catalog.json`. */
      readonly kind: "invalid-structure";
      /** Every problem found. */
      readonly issues: readonly CatalogIssue[];
    }
  | {
      /**
       * The structure is valid, but a rule between fields or entities fails,
       * such as a reference to a paint that does not exist (docs/01 §5).
       */
      readonly kind: "integrity";
      /** Every problem found. */
      readonly issues: readonly CatalogIssue[];
    };

/**
 * Reads only `meta.schemaVersion`, so a newer document is not misreported.
 * Without that field the input is not a catalog of any version: the structure
 * check reports it, instead of suggesting an app update.
 */
const versionProbeSchema = z.object({
  meta: z.object({ schemaVersion: z.unknown() }),
});

/**
 * Validates the content of `catalog.json` and builds the {@link Catalog}.
 * The checks go in order and stop at the first that fails: the version, the
 * structure, and the rules between fields and entities. The expected
 * failures are returned, never thrown.
 *
 * @param input - The parsed JSON, as `response.json()` returns it.
 *
 * @example
 * ```ts
 * const response = await fetch("/catalog.json");
 * const parsed = parseCatalog(await response.json());
 * if (parsed.ok) console.log(parsed.value.brands());
 * ```
 */
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

/**
 * Formats the path of a validation issue: `["paints", 12, "status"]` gives
 * `"paints[12].status"`.
 */
export function formatPath(path: readonly PropertyKey[]): string {
  return path
    .map((segment, i) =>
      typeof segment === "number"
        ? `[${String(segment)}]`
        : `${i === 0 ? "" : "."}${String(segment)}`,
    )
    .join("");
}
