/**
 * Shape and checks of the curated data files (docs/04 §2). The entities reuse
 * the `domain` schemas: the files hold them in their `catalog.json` form.
 */
import {
  brandSchema,
  err,
  formatPath,
  ok,
  paintSchema,
  rangeSchema,
  sourceSchema,
  type Brand,
  type Paint,
  type Range,
  type Result,
  type Source,
} from "@rueda-cromatica/domain";
import { z } from "zod";

/** A problem found in the data, located in its file. */
export interface DataIssue {
  readonly file: string;
  readonly path: string;
  readonly message: string;
}

/** A file already read from disk, with its content parsed as JSON. */
export interface RawFile {
  readonly name: string;
  readonly content: unknown;
}

export const sourcesFileSchema = z.array(sourceSchema).readonly();

export const brandFileSchema = z
  .object({
    brand: brandSchema,
    ranges: z.array(rangeSchema).readonly(),
    paints: z.array(paintSchema).readonly(),
  })
  .readonly();

export interface BrandFile {
  readonly name: string;
  readonly brand: Brand;
  readonly ranges: readonly Range[];
  readonly paints: readonly Paint[];
}

export type FileResult<T> = Result<T, readonly DataIssue[]>;

export function readSourcesFile(file: RawFile): FileResult<readonly Source[]> {
  const parsed = sourcesFileSchema.safeParse(file.content);
  return parsed.success
    ? ok(parsed.data)
    : err(zodIssues(file.name, parsed.error));
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

  if (file.name !== `${brand.id}.json`) {
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
  });

  return issues.length > 0
    ? err(issues)
    : ok({ name: file.name, brand, ranges, paints });
}

function zodIssues(file: string, error: z.ZodError): DataIssue[] {
  return error.issues.map((issue) => ({
    file,
    path: formatPath(issue.path),
    message: issue.message,
  }));
}
