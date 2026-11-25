/**
 * The catalog pack (docs/09 §8.3): the curated files of `data/` and the
 * catalog of the latest release tag, already read, in one JSON file. The CI
 * writes it where the repository and its history are, and the deploy loads
 * it into the database of each environment, where they are not (docs/08). It
 * goes away with `data/` (ADR-0037).
 */
import type {
  CuratedFiles,
  ReleaseCatalog,
} from "@chromatic-wheel/catalog-builder/data";
import {
  err,
  instantSchema,
  ok,
  toInstant,
  type Result,
} from "@chromatic-wheel/domain";
import { z } from "zod";

/** What the deploy loads: the same data as `catalog:load` reads. */
export interface CatalogPack {
  readonly files: CuratedFiles;
  readonly release: ReleaseCatalog | null;
}

const rawFileSchema = z.object({
  name: z.string().min(1),
  content: z.unknown(),
});

const packSchema = z.object({
  format: z.literal(1),
  files: z.object({
    tombstones: rawFileSchema,
    data: z.object({
      ignoreReasons: rawFileSchema,
      colorPolicy: rawFileSchema,
      sources: z.array(rawFileSchema),
      brands: z.array(rawFileSchema),
    }),
  }),
  release: z
    .object({
      tag: z.string().min(1),
      releasedAt: instantSchema,
      text: z.string(),
    })
    .nullable(),
});

/** The text of a pack. */
export function formatCatalogPack({ files, release }: CatalogPack): string {
  return JSON.stringify({
    format: 1,
    files,
    release:
      release === null
        ? null
        : { ...release, releasedAt: toInstant(release.releasedAt) },
  });
}

/**
 * The pack of a text, or the messages to show. Only its shape is checked:
 * each file is validated when it is loaded, as `build-catalog` does.
 */
export function parseCatalogPack(text: string): Result<CatalogPack, string> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return err(
      `Not JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const result = packSchema.safeParse(json);
  if (!result.success) return err(z.prettifyError(result.error));
  const { files, release } = result.data;
  return ok({
    files,
    release:
      release === null
        ? null
        : { ...release, releasedAt: new Date(release.releasedAt) },
  });
}
