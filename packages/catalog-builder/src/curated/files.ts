/**
 * The curated data as files of `data/` (docs/04 §2-5), one reader per file:
 * it validates the content with the schema of the model (`model/curated.ts`),
 * runs the model's checks and those of the file itself, such as being named
 * after its ID, and locates every issue in the file. Pure: the files arrive
 * already read. It goes away with `data/` after the migration (ADR-0037).
 */
import { err, formatPath, ok, type Result } from "@chromatic-wheel/domain";
import type { z } from "zod";
import {
  brandFileSchema,
  brandIssues,
  colorPolicyFileSchema,
  colorPolicyIssues,
  ignoreReasonsFileSchema,
  ignoreReasonsIssues,
  retiredIds,
  sourceFileSchema,
  sourceIssues,
  tombstonesFileSchema,
  type BrandFile,
  type ColorPolicy,
  type Curated,
  type DataIssue,
  type IgnoreReason,
  type PathIssue,
  type SourceFile,
  type Tombstones,
} from "../model/curated.ts";

/**
 * A file already read from disk, with its content parsed as JSON. Its name is
 * its path inside `data/`, such as `brands/citadel.json`.
 */
export interface RawFile {
  readonly name: string;
  readonly content: unknown;
}

export type FileResult<T> = Result<T, readonly DataIssue[]>;

/** Whether a file is named after an ID, as in `brands/<brand-id>.json`. */
const namedAfter = (file: RawFile, id: string): boolean =>
  file.name.split("/").at(-1) === `${id}.json`;

/** Validates a source file; its name is the source ID. */
export function readSourceFile(file: RawFile): FileResult<SourceFile> {
  const parsed = sourceFileSchema.safeParse(file.content);
  if (!parsed.success) return err(zodIssues(file.name, parsed.error));
  const { id } = parsed.data.source;
  const issues = located(file, [
    ...(namedAfter(file, id)
      ? []
      : [
          {
            path: "source.id",
            message: `Must match the file name (expected ${id}.json)`,
          },
        ]),
    ...sourceIssues(parsed.data),
  ]);
  return issues.length > 0
    ? err(issues)
    : ok({ name: file.name, ...parsed.data });
}

/** Validates a brand file and checks that it only holds its own brand. */
export function readBrandFile(file: RawFile): FileResult<BrandFile> {
  const parsed = brandFileSchema.safeParse(file.content);
  if (!parsed.success) return err(zodIssues(file.name, parsed.error));
  const { brand, ranges, paints } = parsed.data;
  const issues = located(file, [
    ...(namedAfter(file, brand.id)
      ? []
      : [
          {
            path: "brand.id",
            message: `Must match the file name (expected ${brand.id}.json)`,
          },
        ]),
    ...brandIssues(parsed.data),
  ]);
  return issues.length > 0
    ? err(issues)
    : ok({ name: file.name, brand, ranges, paints });
}

/** Validates `ignore-reasons.json`. */
export function readIgnoreReasonsFile(
  file: RawFile,
): FileResult<readonly IgnoreReason[]> {
  const parsed = ignoreReasonsFileSchema.safeParse(file.content);
  if (!parsed.success) return err(zodIssues(file.name, parsed.error));
  const issues = located(file, ignoreReasonsIssues(parsed.data));
  return issues.length > 0 ? err(issues) : ok(parsed.data);
}

/** Validates `color-policy.json`. */
export function readColorPolicyFile(file: RawFile): FileResult<ColorPolicy> {
  const parsed = colorPolicyFileSchema.safeParse(file.content);
  if (!parsed.success) return err(zodIssues(file.name, parsed.error));
  const issues = located(file, colorPolicyIssues(parsed.data));
  return issues.length > 0 ? err(issues) : ok(parsed.data);
}

/** Validates `tombstones.json`. */
export function readTombstonesFile(file: RawFile): FileResult<Tombstones> {
  const parsed = tombstonesFileSchema.safeParse(file.content);
  if (!parsed.success) return err(zodIssues(file.name, parsed.error));
  const { tombstones, issues } = retiredIds(parsed.data);
  return issues.length > 0 ? err(located(file, issues)) : ok(tombstones);
}

// ── All the curated files ────────────────────────────────────

/** The curated files, already read from disk (docs/04 §2). */
export interface CuratedData {
  readonly sources: readonly RawFile[];
  readonly brands: readonly RawFile[];
  readonly ignoreReasons: RawFile;
  readonly colorPolicy: RawFile;
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
    policy: { name: data.colorPolicy.name, policy },
  });
}

// ── Shared ───────────────────────────────────────────────────

const located = (file: RawFile, issues: readonly PathIssue[]): DataIssue[] =>
  issues.map((issue) => ({ file: file.name, ...issue }));

function zodIssues(file: string, error: z.ZodError): DataIssue[] {
  return error.issues.map((issue) => ({
    file,
    path: formatPath(issue.path),
    message: issue.message,
  }));
}
