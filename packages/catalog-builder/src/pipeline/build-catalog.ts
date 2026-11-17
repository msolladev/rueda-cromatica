/**
 * Builder process (docs/04 §3): assembles the curated files into the
 * `catalog.json` document, validates it with `parseCatalog` and serialises it
 * deterministically (docs/02 §1). Pure: the files arrive already read.
 */
import { createHash } from "node:crypto";
import {
  compareSortKeys,
  err,
  idSortKey,
  ok,
  parseCatalog,
  SUPPORTED_SCHEMA_VERSION,
  type CatalogDocument,
  type Result,
} from "@chromatic-wheel/domain";
import {
  readBrandFile,
  readSourcesFile,
  type BrandFile,
  type DataIssue,
  type RawFile,
} from "../curated/files.ts";

export interface CuratedData {
  readonly sources: RawFile;
  readonly brands: readonly RawFile[];
}

export interface BuiltCatalog {
  readonly document: CatalogDocument;
  /** Exact content of `catalog.json`. */
  readonly json: string;
}

/** Where an entity of the assembled catalog comes from, to report issues. */
interface Origin {
  readonly file: string;
  readonly path: string;
}

interface Located<T> {
  readonly item: T;
  readonly origin: Origin;
}

export function buildCatalog(
  data: CuratedData,
): Result<BuiltCatalog, readonly DataIssue[]> {
  // 1. Load and check every file, collecting all issues.
  const issues: DataIssue[] = [];
  const sourcesFile = readSourcesFile(data.sources);
  if (!sourcesFile.ok) issues.push(...sourcesFile.error);
  const brandFiles: BrandFile[] = [];
  for (const file of data.brands) {
    const result = readBrandFile(file);
    if (result.ok) brandFiles.push(result.value);
    else issues.push(...result.error);
  }
  if (!sourcesFile.ok || issues.length > 0) return err(issues);

  // 2. Assemble and sort (docs/02 §1).
  const sources = sorted(
    sourcesFile.value.map((item, i) => ({
      item,
      origin: { file: data.sources.name, path: `[${String(i)}]` },
    })),
  );
  const brands = sorted(
    brandFiles.map((file) => ({
      item: file.brand,
      origin: { file: file.name, path: "brand" },
    })),
  );
  const ranges = sorted(
    brandFiles.flatMap((file) =>
      file.ranges.map((item, i) => ({
        item,
        origin: { file: file.name, path: `ranges[${String(i)}]` },
      })),
    ),
  );
  const paints = sorted(
    brandFiles.flatMap((file) =>
      file.paints.map((item, i) => ({
        item,
        origin: { file: file.name, path: `paints[${String(i)}]` },
      })),
    ),
  );

  // Key order follows docs/02; equivalences are empty in the MVP (ADR-0019).
  const body = {
    sources: sources.map((s) => s.item),
    brands: brands.map((b) => b.item),
    ranges: ranges.map((r) => r.item),
    paints: paints.map((p) => p.item),
    equivalences: [],
  };

  // 3. Meta (docs/02 §4).
  const document = {
    meta: { schemaVersion: SUPPORTED_SCHEMA_VERSION, dataVersion: hash(body) },
    ...body,
  };

  // 4. Final validation, with issues located in their files.
  const parsed = parseCatalog(document);
  if (!parsed.ok) {
    if (parsed.error.kind === "unsupported-schema-version") {
      throw new Error("Builder bug: wrote an unsupported schema version");
    }
    const origins = { sources, brands, ranges, paints };
    return err(parsed.error.issues.map((issue) => locate(issue, origins)));
  }

  // 5. Deterministic serialisation (docs/02 §1).
  return ok({ document, json: `${JSON.stringify(document, null, 2)}\n` });
}

function sorted<T extends { readonly id: string }>(
  items: readonly Located<T>[],
): readonly Located<T>[] {
  return [...items].sort((a, b) =>
    compareSortKeys(idSortKey(a.item), idSortKey(b.item)),
  );
}

/** `dataVersion`: SHA-256 of the compact JSON of everything but `meta`. */
function hash(body: object): string {
  const digest = createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex");
  return `sha256:${digest}`;
}

const COLLECTION_PATH = /^(sources|brands|ranges|paints)\[(\d+)\](.*)$/;

/** Turns `paints[12].color` into the file and path where that paint lives. */
function locate(
  issue: { readonly path: string; readonly message: string },
  origins: Readonly<
    Record<
      "sources" | "brands" | "ranges" | "paints",
      readonly Located<unknown>[]
    >
  >,
): DataIssue {
  const match = COLLECTION_PATH.exec(issue.path);
  const [, collection, index, rest] = match ?? [];
  const origin =
    collection === undefined || index === undefined
      ? undefined
      : origins[collection as keyof typeof origins][Number(index)]?.origin;
  return origin === undefined
    ? { file: "catalog.json", path: issue.path, message: issue.message }
    : {
        file: origin.file,
        path: `${origin.path}${rest ?? ""}`,
        message: issue.message,
      };
}
