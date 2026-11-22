/**
 * Builder process (docs/04 §6): reads the curated files, resolves the keys of
 * every source row, takes each paint's colour from its rows and assembles the
 * `catalog.json` document. Then validates it with `parseCatalog` and
 * serialises it deterministically (docs/02 §1). Pure: the files arrive
 * already read.
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
  type Paint,
  type Result,
} from "@chromatic-wheel/domain";
import {
  readCurated,
  type CuratedData,
  type DataIssue,
} from "../curated/files.ts";
import { checkColorPolicy, paintColor } from "./color.ts";
import { resolveKeys } from "./resolve.ts";

export type { CuratedData };

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
  const curated = readCurated(data);
  if (!curated.ok) return err(curated.error);
  const { sources: sourceFiles, brands: brandFiles, policy } = curated.value;

  // 2. Key resolution: every row has one paint or is ignored.
  const resolution = resolveKeys(curated.value);
  const issues: DataIssue[] = [
    ...resolution.issues,
    ...checkColorPolicy(policy, sourceFiles).map((message) => ({
      file: data.colorPolicy.name,
      path: "",
      message,
    })),
  ];

  // 3. The catalog paints, with the colour of their rows.
  const paintItems: Located<Paint>[] = [];
  for (const file of brandFiles) {
    file.paints.forEach((curated, i) => {
      const origin = { file: file.name, path: `paints[${String(i)}]` };
      const color = paintColor(resolution.rows.get(curated.id) ?? [], policy);
      if (!color.ok) {
        issues.push({ ...origin, message: color.error });
        return;
      }
      // Key order of docs/02 §3.
      const item: Paint = {
        id: curated.id,
        rangeId: curated.rangeId,
        name: curated.name,
        aliases: curated.aliases,
        manufacturerCode: curated.manufacturerCode,
        type: curated.type,
        metallic: curated.metallic,
        color: color.value,
        status: curated.status,
      };
      paintItems.push({ item, origin });
    });
  }
  if (issues.length > 0) return err(issues);

  // 4. Assemble and sort (docs/02 §1).
  const sources = sorted(
    sourceFiles.map((file) => ({
      item: file.source,
      origin: { file: file.name, path: "source" },
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
  const paints = sorted(paintItems);

  // Key order follows docs/02; official equivalences arrive in phase 5 step 4.
  const body = {
    sources: sources.map((s) => s.item),
    brands: brands.map((b) => b.item),
    ranges: ranges.map((r) => r.item),
    paints: paints.map((p) => p.item),
    equivalences: [],
  };

  // 5. Meta (docs/02 §4).
  const document = {
    meta: { schemaVersion: SUPPORTED_SCHEMA_VERSION, dataVersion: hash(body) },
    ...body,
  };

  // 6. Final validation, with issues located in their files.
  const parsed = parseCatalog(document);
  if (!parsed.ok) {
    if (parsed.error.kind === "unsupported-schema-version") {
      throw new Error("Builder bug: wrote an unsupported schema version");
    }
    const origins = { sources, brands, ranges, paints };
    return err(parsed.error.issues.map((issue) => locate(issue, origins)));
  }

  // 7. Deterministic serialisation (docs/02 §1).
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
