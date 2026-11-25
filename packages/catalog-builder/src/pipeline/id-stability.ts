/**
 * ID stability (docs/03 §6-7): compares the generated catalog with the latest
 * published one and with the tombstones. Pure: whoever calls it reads the
 * published catalog, from a git tag or from the database.
 */
import { err, isoDateSchema, ok, type Result } from "@chromatic-wheel/domain";
import { z } from "zod";
import {
  ID_COLLECTIONS,
  type IdCollection,
  type Tombstones,
} from "../model/curated.ts";

/** The IDs of each collection of a catalog. */
export type CatalogIds = Readonly<Record<IdCollection, ReadonlySet<string>>>;

/**
 * The IDs of the latest published catalog, with what to call it in the
 * messages, such as its release tag.
 */
export interface PublishedCatalog {
  readonly label: string;
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
    }
  /** Rule 3: the paint a tombstone says remains is not in the catalog. */
  | {
      readonly kind: "remaining-missing";
      readonly collection: "paints";
      readonly id: string;
      readonly remainingPaintId: string;
    };

export const RELEASE_TAG_PREFIX = "release/";
// The date, and the sequence from the second release of a day on (2-9, 10…).
const RELEASE_TAG = /^release\/(\d{4}-\d{2}-\d{2})(?:\.([2-9]|[1-9]\d+))?$/;
const FORMAT = `${RELEASE_TAG_PREFIX}YYYY-MM-DD or ${RELEASE_TAG_PREFIX}YYYY-MM-DD.N (N ≥ 2)`;

/** A release tag: its date and its position among the releases of that day. */
interface Release {
  readonly tag: string;
  readonly date: string;
  readonly sequence: number;
}

/**
 * The date and sequence of a release tag, or `null` if it does not follow
 * the format: the first release of a day has no sequence, and the next ones
 * have `.2`, `.3`… A real date is required.
 */
function parseRelease(tag: string): Release | null {
  const [, date, sequence] = RELEASE_TAG.exec(tag) ?? [];
  if (date === undefined || !isoDateSchema.safeParse(date).success) return null;
  return { tag, date, sequence: sequence === undefined ? 1 : Number(sequence) };
}

/** Newest last: by date and, within a day, by sequence, not alphabetically. */
function byAge(a: Release, b: Release): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.sequence - b.sequence;
}

/** All the `release/*` tags, oldest first, or one message per invalid tag. */
function releasesOf(
  tags: readonly string[],
): Result<readonly Release[], readonly string[]> {
  const candidates = tags.filter((tag) => tag.startsWith(RELEASE_TAG_PREFIX));
  const releases = candidates.map(parseRelease);
  const invalid = candidates.filter((_, i) => releases[i] === null);
  if (invalid.length > 0) {
    return err(
      invalid.map(
        (tag) => `Tag ${tag} does not follow ${FORMAT}; rename or delete it.`,
      ),
    );
  }
  return ok(releases.filter((r) => r !== null).sort(byAge));
}

/**
 * The latest release among the `release/*` tags, or `null` before the first
 * one. Every tag of that namespace must be `release/YYYY-MM-DD`, or
 * `release/YYYY-MM-DD.N` for the N-th release of a day, with a real date.
 */
export function latestRelease(
  tags: readonly string[],
): Result<string | null, readonly string[]> {
  const releases = releasesOf(tags);
  if (!releases.ok) return releases;
  return ok(releases.value.at(-1)?.tag ?? null);
}

/**
 * The tag of a new release on `today` (`YYYY-MM-DD`): `release/<today>` if it
 * is the first one of the day, and `release/<today>.N` for the N-th.
 */
export function nextRelease(
  tags: readonly string[],
  today: string,
): Result<string, readonly string[]> {
  const releases = releasesOf(tags);
  if (!releases.ok) return releases;
  const latest = releases.value.at(-1);
  if (latest !== undefined && latest.date > today) {
    return err([`The latest release, ${latest.tag}, is later than ${today}.`]);
  }
  const sequence = latest?.date === today ? latest.sequence + 1 : 1;
  return ok(
    `${RELEASE_TAG_PREFIX}${today}${sequence === 1 ? "" : `.${String(sequence)}`}`,
  );
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
 * Checks the rules of docs/03 §7 on the four collections. Without a published
 * catalog yet, only rules 2 and 3 apply: until then IDs can be corrected
 * freely. A
 * disabled source leaves the catalog but keeps its file in the curated data,
 * so its ID is not missing: it comes back if the source is enabled again
 * (ADR-0019, decision 5).
 */
export function checkIdStability(input: {
  readonly current: CatalogIds;
  readonly tombstones: Tombstones;
  readonly published: PublishedCatalog | null;
  readonly disabledSources: ReadonlySet<string>;
}): readonly StabilityIssue[] {
  const { current, tombstones, published, disabledSources } = input;
  const byCollection = ID_COLLECTIONS.flatMap(
    (collection): StabilityIssue[] => {
      const now = current[collection];
      const retired = new Set<string>(
        tombstones[collection].map(({ id }) => id),
      );
      const kept = collection === "sources" ? disabledSources : new Set();
      const missing = [...(published?.ids[collection] ?? [])]
        .filter((id) => !now.has(id) && !retired.has(id) && !kept.has(id))
        .map((id) => ({ kind: "missing" as const, collection, id }));
      const reused = [...retired]
        .filter((id) => now.has(id))
        .map((id) => ({ kind: "reused" as const, collection, id }));
      return [...missing, ...reused].sort((a, b) => (a.id < b.id ? -1 : 1));
    },
  );
  const remaining = tombstones.paints.flatMap(({ id, remainingPaintId }) =>
    remainingPaintId === null || current.paints.has(remainingPaintId)
      ? []
      : [
          {
            kind: "remaining-missing" as const,
            collection: "paints" as const,
            id,
            remainingPaintId,
          },
        ],
  );
  return [...byCollection, ...remaining];
}

/** The report shown when the check fails, with how to fix each issue. */
export function formatStabilityIssues(
  issues: readonly StabilityIssue[],
  options: {
    readonly published: string | null;
    readonly tombstonesFile: string;
  },
): string {
  const heading =
    options.published === null
      ? "ID stability (nothing published yet, only the tombstones are checked):"
      : `ID stability against ${options.published}:`;
  const lines = issues.flatMap((issue) => {
    const { collection, id } = issue;
    switch (issue.kind) {
      case "missing":
        return [
          `  ${collection} ${id}: published but missing.`,
          `    A published ID is never deleted. If the product is no longer sold, restore it`,
          `    with status "discontinued". If it was a registration error, add it to`,
          `    ${options.tombstonesFile} with its reason (docs/03 §6):`,
          collection === "paints"
            ? `      "paints": [{ "id": "${id}", "reason": "…", "remainingPaintId": null }]`
            : `      "${collection}": [{ "id": "${id}", "reason": "…" }]`,
        ];
      case "reused":
        return [
          `  ${collection} ${id}: tombstoned, and a tombstoned ID is never reused.`,
          `    Choose another ID (docs/03 §3).`,
        ];
      case "remaining-missing":
        return [
          `  paints ${id}: its tombstone says ${issue.remainingPaintId} remains, but that paint`,
          `    is not in the catalog. Name a paint of the catalog, or null.`,
        ];
    }
  });
  return [heading, ...lines].join("\n");
}
