/**
 * Shapes and checks of the curated data files (docs/04 §2-5), one reader per
 * file. Each reader checks what can be checked inside its own file; what
 * crosses files (keys, ignores, reasons) is resolved in `pipeline/resolve.ts`.
 * The schemas are strict: an unknown field is an error, not a silent drop.
 */
import {
  brandIdSchema,
  brandSchema,
  colorOriginSchema,
  err,
  formatPath,
  hexColorSchema,
  ok,
  paintIdSchema,
  paintSchema,
  rangeIdSchema,
  rangeSchema,
  sourceIdSchema,
  sourceSchema,
  type Result,
} from "@chromatic-wheel/domain";
import { z } from "zod";

/** A problem found in the data, located in its file. */
export interface DataIssue {
  readonly file: string;
  readonly path: string;
  readonly message: string;
}

/**
 * A file already read from disk, with its content parsed as JSON. Its name is
 * its path inside `data/`, such as `brands/citadel.json`.
 */
export interface RawFile {
  readonly name: string;
  readonly content: unknown;
}

/** Whether a file is named after an ID, as in `brands/<brand-id>.json`. */
const namedAfter = (file: RawFile, id: string): boolean =>
  file.name.split("/").at(-1) === `${id}.json`;

export type FileResult<T> = Result<T, readonly DataIssue[]>;

const text = z.string().trim().min(1);
const note = text.nullable();
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
/** A hex as the source writes it, in either case. */
const literalHex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

// ── sources/<source-id>.json: what each source says (docs/04 §3) ──

/** One row of a source, copied literally, typos included. */
export const sourceRowSchema = z
  .strictObject({
    /** How the source identifies the paint. Unique within the source. */
    key: text,
    /** The source's own grouping (a set, a table type, a chart section). */
    group: text,
    /** Empty in a few rows of DonnervS, as published. */
    name: z.string(),
    code: text.nullable(),
    hex: literalHex.nullable(),
    gradient: z
      .strictObject({ dark: literalHex, light: literalHex })
      .readonly()
      .nullable(),
    /** An instrument reading published apart from `hex`. */
    measuredHex: literalHex.nullable(),
    /** The finish as the source names it (`metal`, `gloss`…). */
    finish: text.nullable(),
    /** Whether the source marks the product as having no colour. */
    colourless: z.boolean(),
  })
  .refine((row) => row.hex === null || row.gradient === null, {
    message: "A row has a hex or a gradient, not both",
  })
  .readonly();

/**
 * One equivalence of a conversion chart, copied literally (ADR-0033): the keys
 * of two rows of the same source, in the direction the chart publishes. A
 * cell that names two paints, such as «049/047», is two equivalences, with a
 * note.
 */
export const equivalenceRowSchema = z
  .strictObject({ from: text, to: text, note })
  .refine((row) => row.from !== row.to, {
    message: "An equivalence joins two different rows",
  })
  .readonly();

const ignoredSchema = <T extends z.ZodRawShape>(shape: T) =>
  z.strictObject({ ...shape, reasonId: slug, note }).readonly();

/**
 * Why a source is disabled (ADR-0015): it stays in the curated data, but it
 * leaves `catalog.json` and gives no colour.
 */
export const sourceDisabledSchema = z.strictObject({ note: text }).readonly();

/**
 * A file of the source downloaded by `archive-sources` (ADR-0015), outside
 * the repository: the URL it was downloaded from, its name in the downloads
 * folder of the source and its SHA-256.
 */
export const sourceDownloadSchema = z
  .strictObject({
    url: z.url({ protocol: /^https?$/ }),
    name: z
      .string()
      .regex(/^[^/\\]+$/)
      .refine((name) => name !== "." && name !== "..", "Not a file name"),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly();

export const sourceFileSchema = z
  .strictObject({
    /** The source as it goes to `catalog.json`. */
    source: z.strictObject(sourceSchema.unwrap().shape).readonly(),
    /** `null` if the source is enabled. */
    disabled: sourceDisabledSchema.nullable(),
    /** The files downloaded by `archive-sources`; empty until it runs. */
    files: z.array(sourceDownloadSchema).readonly(),
    paints: z.array(sourceRowSchema).readonly(),
    /** The equivalences of a conversion chart; empty in any other source. */
    equivalences: z.array(equivalenceRowSchema).readonly(),
    /** Whole groups left out of the catalog, with their reason. */
    ignoredGroups: z.array(ignoredSchema({ group: text })).readonly(),
    /** Single rows left out of the catalog, with their reason. */
    ignoredKeys: z.array(ignoredSchema({ key: text })).readonly(),
  })
  .readonly();

export type SourceRow = z.infer<typeof sourceRowSchema>;
export type EquivalenceRow = z.infer<typeof equivalenceRowSchema>;
export type SourceDownload = z.infer<typeof sourceDownloadSchema>;
export type SourceFileContent = z.infer<typeof sourceFileSchema>;
export interface SourceFile extends SourceFileContent {
  readonly name: string;
}

/** The content of a source file, in the order of its schema. */
export function sourceContent(file: SourceFile): SourceFileContent {
  return {
    source: file.source,
    disabled: file.disabled,
    files: file.files,
    paints: file.paints,
    equivalences: file.equivalences,
    ignoredGroups: file.ignoredGroups,
    ignoredKeys: file.ignoredKeys,
  };
}

/** Validates a source file; its name is the source ID. */
export function readSourceFile(file: RawFile): FileResult<SourceFile> {
  const parsed = sourceFileSchema.safeParse(file.content);
  if (!parsed.success) return err(zodIssues(file.name, parsed.error));
  const issues: DataIssue[] = [];
  const { source } = parsed.data;
  const report = (path: string, message: string): void => {
    issues.push({ file: file.name, path, message });
  };
  if (!namedAfter(file, source.id)) {
    report(
      "source.id",
      `Must match the file name (expected ${source.id}.json)`,
    );
  }
  if (
    source.archiveUrl !== null &&
    (source.url === null || captureOf(source.archiveUrl) !== source.url)
  ) {
    report(
      "source.archiveUrl",
      `Must be a capture of the source URL, https://web.archive.org/web/<timestamp>/${source.url ?? "<url>"}; if the URL changed, set it to null and run archive-sources`,
    );
  }
  for (const path of repeated(
    parsed.data.files.map(({ name }) => name),
    (i) => `files[${String(i)}].name`,
  )) {
    report(path.path, path.message);
  }
  return issues.length > 0
    ? err(issues)
    : ok({ name: file.name, ...parsed.data });
}

const CAPTURE = /^https:\/\/web\.archive\.org\/web\/\d{14}\/(.+)$/;

/**
 * The URL captured by a Wayback Machine playback URL,
 * `https://web.archive.org/web/<timestamp>/<url>`, or `null` if it is not one.
 */
export function captureOf(archiveUrl: string): string | null {
  return CAPTURE.exec(archiveUrl)?.[1] ?? null;
}

// ── brands/<brand-id>.json: the curated paints (docs/04 §4) ──

/** Where a source lists a paint: its key in that source. */
export const paintKeySchema = z
  .strictObject({ sourceId: sourceIdSchema, key: text })
  .readonly();

/**
 * One colour candidate of a paint, with the hex it gave when it was reviewed
 * (ADR-0031). The source and the origin identify it: a row gives at most one
 * hex per origin. The hex is the published form, `#rrggbb` in lowercase.
 */
const candidateShape = {
  sourceId: sourceIdSchema,
  origin: colorOriginSchema,
  hex: hexColorSchema,
};

/** The candidate published instead of the one the priority picks. */
export const colorChoiceSchema = z
  .strictObject({ ...candidateShape, note: text })
  .readonly();

/** A candidate left out, so the priority picks among the rest. */
export const rejectedColorSchema = z
  .strictObject({ ...candidateShape, reasonId: slug, note })
  .readonly();

/**
 * The source whose replacement is published when two manufacturer documents
 * name different ones (ADR-0019, decision 1), always with its note.
 */
export const replacementChoiceSchema = z
  .strictObject({ sourceId: sourceIdSchema, note: text })
  .readonly();

/**
 * The status of a curated paint. A discontinued paint does not write its
 * replacement: the builder takes it from the transcriptions of the
 * manufacturer documents, and the paint only chooses among them when they
 * contradict each other (ADR-0019, decision 1).
 */
export const curatedStatusSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("active") }).readonly(),
  z
    .strictObject({
      kind: z.literal("discontinued"),
      replacementChoice: replacementChoiceSchema.nullable(),
    })
    .readonly(),
]);

/**
 * A curated paint: the `catalog.json` paint without its colour, which the
 * builder takes from the sources, plus its keys, its colour corrections and a
 * curation note.
 */
export const curatedPaintSchema = z
  .strictObject({
    ...paintSchema.unwrap().omit({ color: true }).shape,
    status: curatedStatusSchema,
    /** At least one, so every paint comes from some source (ADR-0019, 6). */
    keys: z.array(paintKeySchema).min(1).readonly(),
    /** A manual choice, always with its note (ADR-0014). */
    colorChoice: colorChoiceSchema.nullable(),
    rejectedColors: z.array(rejectedColorSchema).readonly(),
    note,
  })
  .readonly();

export const brandFileSchema = z
  .strictObject({
    brand: z.strictObject(brandSchema.unwrap().shape).readonly(),
    ranges: z.array(z.strictObject(rangeSchema.unwrap().shape).readonly()),
    paints: z.array(curatedPaintSchema).readonly(),
  })
  .readonly();

export type PaintKey = z.infer<typeof paintKeySchema>;
export type ColorChoice = z.infer<typeof colorChoiceSchema>;
export type RejectedColor = z.infer<typeof rejectedColorSchema>;
export type CuratedPaint = z.infer<typeof curatedPaintSchema>;
export type BrandFileContent = z.infer<typeof brandFileSchema>;
export interface BrandFile extends BrandFileContent {
  readonly name: string;
}

/** Validates a brand file and checks that it only holds its own brand. */
export function readBrandFile(file: RawFile): FileResult<BrandFile> {
  const parsed = brandFileSchema.safeParse(file.content);
  if (!parsed.success) {
    return err(zodIssues(file.name, parsed.error));
  }
  const { brand, ranges, paints } = parsed.data;
  const issues: DataIssue[] = [];
  const report = (path: string, message: string): void => {
    issues.push({ file: file.name, path, message });
  };

  if (!namedAfter(file, brand.id)) {
    report("brand.id", `Must match the file name (expected ${brand.id}.json)`);
  }
  const rangeIds = new Set<string>();
  ranges.forEach((range, i) => {
    rangeIds.add(range.id);
    if (range.brandId !== brand.id) {
      report(
        `ranges[${String(i)}].brandId`,
        `Must be ${brand.id}, the brand of this file`,
      );
    }
  });
  paints.forEach((paint, i) => {
    if (!rangeIds.has(paint.rangeId)) {
      report(
        `paints[${String(i)}].rangeId`,
        `Range ${paint.rangeId} is not in this file`,
      );
    }
    const sources = new Set<string>();
    paint.keys.forEach(({ sourceId }, k) => {
      if (sources.has(sourceId)) {
        report(
          `paints[${String(i)}].keys[${String(k)}]`,
          `A paint has one key per source; ${sourceId} is repeated`,
        );
      }
      sources.add(sourceId);
    });
  });

  return issues.length > 0
    ? err(issues)
    : ok({ name: file.name, brand, ranges, paints });
}

// ── ignore-reasons.json (docs/04 §5) ─────────────────────────

export const ignoreReasonsFileSchema = z
  .array(z.strictObject({ id: slug, text }).readonly())
  .readonly();

export type IgnoreReason = z.infer<typeof ignoreReasonsFileSchema>[number];

/** Validates `ignore-reasons.json`; an ID may appear only once. */
export function readIgnoreReasonsFile(
  file: RawFile,
): FileResult<readonly IgnoreReason[]> {
  const parsed = ignoreReasonsFileSchema.safeParse(file.content);
  if (!parsed.success) return err(zodIssues(file.name, parsed.error));
  const issues = repeated(
    parsed.data.map(({ id }) => id),
    (i) => `[${String(i)}].id`,
  ).map((issue) => ({ file: file.name, ...issue }));
  return issues.length > 0 ? err(issues) : ok(parsed.data);
}

// ── color-policy.json (docs/04 §5, ADR-0014) ─────────────────

/**
 * The sources of each colour origin, in order of preference. A source's hex
 * and gradients take the origin of the list where it appears; its measured
 * hex is only used if it also appears in `measured`.
 */
export const colorPolicyFileSchema = z
  .strictObject({
    measured: z.array(sourceIdSchema).readonly(),
    manufacturer: z.array(sourceIdSchema).readonly(),
    community: z.array(sourceIdSchema).readonly(),
  })
  .readonly();

export type ColorPolicy = z.infer<typeof colorPolicyFileSchema>;

/** Validates `color-policy.json`: a source is in one hex list at most. */
export function readColorPolicyFile(file: RawFile): FileResult<ColorPolicy> {
  const parsed = colorPolicyFileSchema.safeParse(file.content);
  if (!parsed.success) return err(zodIssues(file.name, parsed.error));
  const { measured, manufacturer, community } = parsed.data;
  const issues = [
    ...repeated(measured, (i) => `measured[${String(i)}]`),
    ...repeated([...manufacturer, ...community], (i) =>
      i < manufacturer.length
        ? `manufacturer[${String(i)}]`
        : `community[${String(i - manufacturer.length)}]`,
    ),
  ].map((issue) => ({ file: file.name, ...issue }));
  return issues.length > 0 ? err(issues) : ok(parsed.data);
}

// ── tombstones.json (docs/03 §6) ─────────────────────────────

/** The four collections whose IDs are kept stable (docs/03 §7). */
export const ID_COLLECTIONS = [
  "sources",
  "brands",
  "ranges",
  "paints",
] as const;
export type IdCollection = (typeof ID_COLLECTIONS)[number];

const tombstone = <T extends z.ZodType>(id: T) =>
  z.strictObject({ id, reason: text }).readonly();

/** `tombstones.json`: the IDs retired because of registration errors (docs/03 §6). */
export const tombstonesFileSchema = z
  .strictObject({
    sources: z.array(tombstone(sourceIdSchema)).readonly(),
    brands: z.array(tombstone(brandIdSchema)).readonly(),
    ranges: z.array(tombstone(rangeIdSchema)).readonly(),
    paints: z.array(tombstone(paintIdSchema)).readonly(),
  })
  .readonly();

/** The retired IDs of each collection. */
export type Tombstones = Readonly<Record<IdCollection, ReadonlySet<string>>>;

/** Validates `tombstones.json`; an ID may appear only once per collection. */
export function readTombstonesFile(file: RawFile): FileResult<Tombstones> {
  const parsed = tombstonesFileSchema.safeParse(file.content);
  if (!parsed.success) return err(zodIssues(file.name, parsed.error));

  const issues: DataIssue[] = [];
  const ids = (collection: IdCollection): ReadonlySet<string> => {
    const seen = new Set<string>();
    parsed.data[collection].forEach(({ id }, i) => {
      if (seen.has(id)) {
        issues.push({
          file: file.name,
          path: `${collection}[${String(i)}].id`,
          message: `${id} is already tombstoned`,
        });
      }
      seen.add(id);
    });
    return seen;
  };
  const sets = {
    sources: ids("sources"),
    brands: ids("brands"),
    ranges: ids("ranges"),
    paints: ids("paints"),
  };
  return issues.length > 0 ? err(issues) : ok(sets);
}

// ── Shared ───────────────────────────────────────────────────

/** The path of every value that already appeared before it. */
function repeated(
  values: readonly string[],
  pathOf: (index: number) => string,
): { readonly path: string; readonly message: string }[] {
  return values.flatMap((value, i) =>
    values.indexOf(value) < i
      ? [{ path: pathOf(i), message: `${value} is repeated` }]
      : [],
  );
}

function zodIssues(file: string, error: z.ZodError): DataIssue[] {
  return error.issues.map((issue) => ({
    file,
    path: formatPath(issue.path),
    message: issue.message,
  }));
}

// ── All the curated files ────────────────────────────────────

/** The curated files, already read from disk (docs/04 §2). */
export interface CuratedData {
  readonly sources: readonly RawFile[];
  readonly brands: readonly RawFile[];
  readonly ignoreReasons: RawFile;
  readonly colorPolicy: RawFile;
}

export interface Curated {
  readonly sources: readonly SourceFile[];
  readonly brands: readonly BrandFile[];
  readonly reasons: {
    readonly name: string;
    readonly reasons: readonly IgnoreReason[];
  };
  readonly policy: ColorPolicy;
}

/** Validates every curated file, collecting the issues of all of them. */
export function readCurated(data: CuratedData): FileResult<Curated> {
  const issues: DataIssue[] = [];
  const collect = <T>(result: FileResult<T>): T[] => {
    if (result.ok) return [result.value];
    issues.push(...result.error);
    return [];
  };
  const sources = data.sources.flatMap((file) => collect(readSourceFile(file)));
  const brands = data.brands.flatMap((file) => collect(readBrandFile(file)));
  const [reasons] = collect(readIgnoreReasonsFile(data.ignoreReasons));
  const [policy] = collect(readColorPolicyFile(data.colorPolicy));
  if (reasons === undefined || policy === undefined || issues.length > 0) {
    return err(issues);
  }
  return ok({
    sources,
    brands,
    reasons: { name: data.ignoreReasons.name, reasons },
    policy,
  });
}
