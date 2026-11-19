/**
 * ID stability (docs/03 §6-7): compares the generated catalog with the one of
 * the latest release and with the tombstones. Pure: git and the disk are read
 * by the entry point.
 */
import { err, isoDateSchema, ok, type Result } from "@chromatic-wheel/domain";
import { z } from "zod";
import {
  ID_COLLECTIONS,
  type IdCollection,
  type Tombstones,
} from "../curated/files.ts";

/** The IDs of each collection of a catalog. */
export type CatalogIds = Readonly<Record<IdCollection, ReadonlySet<string>>>;

/** The catalog of a release, as read from its tag. */
export interface PublishedCatalog {
  readonly release: string;
  readonly ids: CatalogIds;
}

export type StabilityIssue =
  /** Rule 1: a published ID is neither in the catalog nor tombstoned. */
  | {
      readonly kind: "missing";
      readonly collection: IdCollection;
      readonly id: string;
    }
  /** Rule 2: a tombstoned ID is in the catalog. */
  | {
      readonly kind: "reused";
      readonly collection: IdCollection;
      readonly id: string;
    };

const RELEASE_TAG = /^release\/(\d{4}-\d{2}-\d{2})$/;
export const RELEASE_TAG_PREFIX = "release/";

/**
 * The latest release among the `release/*` tags, or `null` before the first
 * one. Every tag of that namespace must be `release/YYYY-MM-DD` with a real
 * date, so the alphabetical order is the chronological one.
 */
export function latestRelease(
  tags: readonly string[],
): Result<string | null, readonly string[]> {
  const releases = tags.filter((tag) => tag.startsWith(RELEASE_TAG_PREFIX));
  const invalid = releases.filter((tag) => {
    const date = RELEASE_TAG.exec(tag)?.[1];
    return date === undefined || !isoDateSchema.safeParse(date).success;
  });
  if (invalid.length > 0) {
    return err(
      invalid.map(
        (tag) =>
          `Tag ${tag} does not follow ${RELEASE_TAG_PREFIX}YYYY-MM-DD; rename or delete it.`,
      ),
    );
  }
  return ok(releases.sort().at(-1) ?? null);
}

const withIds = z.array(z.looseObject({ id: z.string() }));

/**
 * Only the IDs are read from a published catalog, so the check keeps working
 * if a later schema version changes everything else.
 */
const publishedSchema = z.looseObject({
  sources: withIds,
  brands: withIds,
  ranges: withIds,
  paints: withIds,
});

/** Extracts the IDs of a catalog, published or just built. */
export function catalogIds(content: unknown): Result<CatalogIds, string> {
  const parsed = publishedSchema.safeParse(content);
  if (!parsed.success) return err(z.prettifyError(parsed.error));
  const ids = (collection: IdCollection): ReadonlySet<string> =>
    new Set(parsed.data[collection].map(({ id }) => id));
  return ok({
    sources: ids("sources"),
    brands: ids("brands"),
    ranges: ids("ranges"),
    paints: ids("paints"),
  });
}

/**
 * Checks both rules of docs/03 §7 on the four collections. Without a release
 * yet, only rule 2 applies: until then IDs can be corrected freely.
 */
export function checkIdStability(input: {
  readonly current: CatalogIds;
  readonly tombstones: Tombstones;
  readonly published: PublishedCatalog | null;
}): readonly StabilityIssue[] {
  const { current, tombstones, published } = input;
  return ID_COLLECTIONS.flatMap((collection): StabilityIssue[] => {
    const now = current[collection];
    const retired = tombstones[collection];
    const missing = [...(published?.ids[collection] ?? [])]
      .filter((id) => !now.has(id) && !retired.has(id))
      .map((id) => ({ kind: "missing" as const, collection, id }));
    const reused = [...retired]
      .filter((id) => now.has(id))
      .map((id) => ({ kind: "reused" as const, collection, id }));
    return [...missing, ...reused].sort((a, b) => (a.id < b.id ? -1 : 1));
  });
}

/** The report shown when the check fails, with how to fix each issue. */
export function formatStabilityIssues(
  issues: readonly StabilityIssue[],
  options: {
    readonly release: string | null;
    readonly tombstonesFile: string;
  },
): string {
  const heading =
    options.release === null
      ? "ID stability (no release yet, only the tombstones are checked):"
      : `ID stability against ${options.release}:`;
  const lines = issues.flatMap(({ kind, collection, id }) =>
    kind === "missing"
      ? [
          `  ${collection} ${id}: published but missing.`,
          `    A published ID is never deleted. If the product is no longer sold, restore it`,
          `    with status "discontinued". If it was a registration error, add it to`,
          `    ${options.tombstonesFile} with its reason (docs/03 §6):`,
          `      "${collection}": [{ "id": "${id}", "reason": "…" }]`,
        ]
      : [
          `  ${collection} ${id}: tombstoned, and a tombstoned ID is never reused.`,
          `    Choose another ID (docs/03 §3).`,
        ],
  );
  return [heading, ...lines].join("\n");
}
