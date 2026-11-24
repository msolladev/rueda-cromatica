/**
 * The conversion between the tables of the draft and the curated data of
 * `catalog-builder` (ADR-0043), in both directions. Pure: the queries and the
 * writes are in `draft.service.ts`.
 *
 * Read from the tables, the draft takes the shape of the files of `data/`,
 * with their names, so that `catalog-builder` validates it with the same
 * readers and reports each issue where Miguel finds it today. Written to
 * them, every list keeps its order in `position`, and every reference
 * becomes the internal `id` of what it points to.
 */
import type {
  Curated,
  CuratedData,
  RawFile,
  Tombstones,
} from "@chromatic-wheel/catalog-builder";
import type {
  Brand,
  ColorPolicyEntry,
  IgnoredGroup,
  IgnoredKey,
  IgnoreReason,
  Paint,
  PaintKey,
  Range,
  RejectedColor,
  Source,
  SourceDownload,
  SourceEquivalence,
  SourceReplacement,
  SourceRow,
  Tombstone,
} from "../../generated/prisma/client.ts";

/** Every table of the draft, each one in the order of `position`. */
export interface DraftTables {
  readonly sources: readonly Source[];
  readonly downloads: readonly SourceDownload[];
  readonly rows: readonly SourceRow[];
  readonly equivalences: readonly SourceEquivalence[];
  readonly replacements: readonly SourceReplacement[];
  readonly reasons: readonly IgnoreReason[];
  readonly ignoredGroups: readonly IgnoredGroup[];
  readonly ignoredKeys: readonly IgnoredKey[];
  readonly colorPolicy: readonly ColorPolicyEntry[];
  readonly brands: readonly Brand[];
  readonly ranges: readonly Range[];
  readonly paints: readonly Paint[];
  readonly paintKeys: readonly PaintKey[];
  readonly rejectedColors: readonly RejectedColor[];
  readonly tombstones: readonly Tombstone[];
}

/** The draft as the files of `data/`, as `readCuratedFiles` reads them. */
export interface DraftFiles {
  readonly data: CuratedData;
  readonly tombstones: RawFile;
}

const COLLECTIONS = ["sources", "brands", "ranges", "paints"] as const;
const ORIGINS = ["measured", "manufacturer", "community"] as const;

/** The date part of a `date` column, `YYYY-MM-DD`. */
const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

/** A `date` column for a `YYYY-MM-DD`, at midnight UTC. */
const dateColumn = (date: string): Date => new Date(`${date}T00:00:00.000Z`);

/** Groups the rows of a table by the internal ID they belong to. */
function byOwner<T>(
  rows: readonly T[],
  owner: (row: T) => bigint,
): (id: bigint) => readonly T[] {
  const groups = new Map<bigint, T[]>();
  for (const row of rows) {
    const id = owner(row);
    const group = groups.get(id);
    if (group === undefined) groups.set(id, [row]);
    else group.push(row);
  }
  return (id) => groups.get(id) ?? [];
}

/** The internal ID → the value of a column, failing on a broken reference. */
function lookup<T extends { readonly id: bigint }>(
  rows: readonly T[],
  value: (row: T) => string,
): (id: bigint) => string {
  const values = new Map(rows.map((row) => [row.id, value(row)]));
  return (id) => {
    const found = values.get(id);
    if (found === undefined) throw new Error(`No row with id ${String(id)}`);
    return found;
  };
}

// ── From the tables ──────────────────────────────────────────

/** The draft as the files of `data/`, unvalidated. */
export function draftFiles(tables: DraftTables): DraftFiles {
  const sourceId = lookup(tables.sources, (source) => source.catalogId);
  const reasonId = lookup(tables.reasons, (reason) => reason.slug);
  const rangeId = lookup(tables.ranges, (range) => range.catalogId);
  const paintId = lookup(tables.paints, (paint) => paint.catalogId);
  const downloadsOf = byOwner(tables.downloads, (row) => row.sourceId);
  const rowsOf = byOwner(tables.rows, (row) => row.sourceId);
  const equivalencesOf = byOwner(tables.equivalences, (row) => row.sourceId);
  const replacementsOf = byOwner(tables.replacements, (row) => row.sourceId);
  const ignoredGroupsOf = byOwner(tables.ignoredGroups, (row) => row.sourceId);
  const ignoredKeysOf = byOwner(tables.ignoredKeys, (row) => row.sourceId);
  const rangesOf = byOwner(tables.ranges, (range) => range.brandId);
  const paintsOf = byOwner(tables.paints, (paint) => paint.brandId);
  const keysOf = byOwner(tables.paintKeys, (key) => key.paintId);
  const rejectedOf = byOwner(tables.rejectedColors, (row) => row.paintId);
  const pair = (row: SourceEquivalence | SourceReplacement) => ({
    from: row.fromKey,
    to: row.toKey,
    note: row.note,
  });

  const sources = tables.sources.map((source): RawFile => ({
    name: `sources/${source.catalogId}.json`,
    content: {
      source: {
        id: source.catalogId,
        kind: source.kind,
        title: source.title,
        publisher: source.publisher,
        url: source.url,
        archiveUrl: source.archiveUrl,
        retrievedAt: isoDate(source.retrievedAt),
        license: source.license,
        attribution: source.attribution,
      },
      disabled:
        source.disabledNote === null ? null : { note: source.disabledNote },
      files: downloadsOf(source.id).map(({ url, name, sha256 }) => ({
        url,
        name,
        sha256,
      })),
      paints: rowsOf(source.id).map((row) => ({
        key: row.key,
        group: row.group,
        name: row.name,
        code: row.code,
        hex: row.hex,
        gradient:
          row.gradientDark === null || row.gradientLight === null
            ? null
            : { dark: row.gradientDark, light: row.gradientLight },
        measuredHex: row.measuredHex,
        finish: row.finish,
        colourless: row.colourless,
      })),
      equivalences: equivalencesOf(source.id).map(pair),
      replacements: replacementsOf(source.id).map(pair),
      ignoredGroups: ignoredGroupsOf(source.id).map((row) => ({
        group: row.group,
        reasonId: reasonId(row.reasonId),
        note: row.note,
      })),
      ignoredKeys: ignoredKeysOf(source.id).map((row) => ({
        key: row.key,
        reasonId: reasonId(row.reasonId),
        note: row.note,
      })),
    },
  }));

  const brands = tables.brands.map((brand): RawFile => ({
    name: `brands/${brand.catalogId}.json`,
    content: {
      brand: { id: brand.catalogId, name: brand.name, aliases: brand.aliases },
      ranges: rangesOf(brand.id).map((range) => ({
        id: range.catalogId,
        brandId: brand.catalogId,
        name: range.name,
        status: range.status,
      })),
      paints: paintsOf(brand.id).map((paint) => ({
        id: paint.catalogId,
        rangeId: rangeId(paint.rangeId),
        name: paint.name,
        aliases: paint.aliases,
        manufacturerCode: paint.manufacturerCode,
        type: paint.type,
        metallic: paint.metallic,
        status:
          paint.statusKind === "discontinued"
            ? {
                kind: "discontinued",
                replacementChoice:
                  paint.replacementChoiceSourceId === null
                    ? null
                    : {
                        sourceId: sourceId(paint.replacementChoiceSourceId),
                        note: paint.replacementChoiceNote,
                      },
              }
            : { kind: paint.statusKind },
        keys: keysOf(paint.id).map((key) => ({
          sourceId: sourceId(key.sourceId),
          key: key.key,
        })),
        colorChoice:
          paint.colorChoiceSourceId === null
            ? null
            : {
                sourceId: sourceId(paint.colorChoiceSourceId),
                origin: paint.colorChoiceOrigin,
                hex: paint.colorChoiceHex,
                note: paint.colorChoiceNote,
              },
        rejectedColors: rejectedOf(paint.id).map((row) => ({
          sourceId: sourceId(row.sourceId),
          origin: row.origin,
          hex: row.hex,
          reasonId: reasonId(row.reasonId),
          note: row.note,
        })),
        note: paint.note,
      })),
    },
  }));

  const policyOf = (origin: string) =>
    tables.colorPolicy
      .filter((entry) => entry.origin === origin)
      .map((entry) => sourceId(entry.sourceId));
  const tombstonesOf = (collection: string) =>
    tables.tombstones
      .filter((tombstone) => tombstone.collection === collection)
      .map((tombstone) =>
        collection === "paints"
          ? {
              id: tombstone.catalogId,
              reason: tombstone.reason,
              remainingPaintId:
                tombstone.remainingPaintId === null
                  ? null
                  : paintId(tombstone.remainingPaintId),
            }
          : { id: tombstone.catalogId, reason: tombstone.reason },
      );

  return {
    data: {
      sources,
      brands,
      ignoreReasons: {
        name: "ignore-reasons.json",
        content: tables.reasons.map(({ slug, text }) => ({ id: slug, text })),
      },
      colorPolicy: {
        name: "color-policy.json",
        content: Object.fromEntries(ORIGINS.map((o) => [o, policyOf(o)])),
      },
    },
    tombstones: {
      name: "tombstones.json",
      content: Object.fromEntries(COLLECTIONS.map((c) => [c, tombstonesOf(c)])),
    },
  };
}

// ── To the tables ────────────────────────────────────────────

/** The internal IDs of what the next rows point to, by their own ID. */
export type Ids = ReadonlyMap<string, bigint>;

/** Finds an internal ID, failing on a reference the curated data lacks. */
function idOf(ids: Ids, key: string): bigint {
  const id = ids.get(key);
  if (id === undefined) throw new Error(`Nothing written for ${key}`);
  return id;
}

/** The rows that point to nothing: the reasons, the sources and the brands. */
export function rootRecords(curated: Curated) {
  return {
    reasons: curated.reasons.reasons.map((reason, position) => ({
      slug: reason.id,
      position,
      text: reason.text,
    })),
    sources: curated.sources.map((file, position) => ({
      catalogId: file.source.id,
      position,
      kind: file.source.kind,
      title: file.source.title,
      publisher: file.source.publisher,
      url: file.source.url,
      archiveUrl: file.source.archiveUrl,
      retrievedAt: dateColumn(file.source.retrievedAt),
      license: file.source.license,
      attribution: file.source.attribution,
      disabledNote: file.disabled?.note ?? null,
    })),
    brands: curated.brands.map(({ brand }, position) => ({
      catalogId: brand.id,
      position,
      name: brand.name,
      aliases: [...brand.aliases],
    })),
  };
}

/** What belongs to a source, and the ranges of each brand. */
export function sourceAndRangeRecords(
  curated: Curated,
  ids: { readonly sources: Ids; readonly reasons: Ids; readonly brands: Ids },
) {
  const inSource = curated.sources.map((file) => ({
    file,
    sourceId: idOf(ids.sources, file.source.id),
  }));
  const pairs = (kind: "equivalences" | "replacements") =>
    inSource.flatMap(({ file, sourceId }) =>
      file[kind].map((row, position) => ({
        sourceId,
        position,
        fromKey: row.from,
        toKey: row.to,
        note: row.note,
      })),
    );
  return {
    downloads: inSource.flatMap(({ file, sourceId }) =>
      file.files.map((download, position) => ({
        sourceId,
        position,
        ...download,
      })),
    ),
    rows: inSource.flatMap(({ file, sourceId }) =>
      file.paints.map((row, position) => ({
        sourceId,
        position,
        key: row.key,
        group: row.group,
        name: row.name,
        code: row.code,
        hex: row.hex,
        gradientDark: row.gradient?.dark ?? null,
        gradientLight: row.gradient?.light ?? null,
        measuredHex: row.measuredHex,
        finish: row.finish,
        colourless: row.colourless,
      })),
    ),
    equivalences: pairs("equivalences"),
    replacements: pairs("replacements"),
    ignoredGroups: inSource.flatMap(({ file, sourceId }) =>
      file.ignoredGroups.map((row, position) => ({
        sourceId,
        position,
        group: row.group,
        reasonId: idOf(ids.reasons, row.reasonId),
        note: row.note,
      })),
    ),
    ignoredKeys: inSource.flatMap(({ file, sourceId }) =>
      file.ignoredKeys.map((row, position) => ({
        sourceId,
        position,
        key: row.key,
        reasonId: idOf(ids.reasons, row.reasonId),
        note: row.note,
      })),
    ),
    colorPolicy: ORIGINS.flatMap((origin) =>
      curated.policy.policy[origin].map((source, position) => ({
        origin,
        position,
        sourceId: idOf(ids.sources, source),
      })),
    ),
    ranges: curated.brands.flatMap(({ brand, ranges }) =>
      ranges.map((range, position) => ({
        catalogId: range.id,
        brandId: idOf(ids.brands, brand.id),
        position,
        name: range.name,
        status: range.status,
      })),
    ),
  };
}

/** The curated paints of each brand. */
export function paintRecords(
  curated: Curated,
  ids: { readonly sources: Ids; readonly brands: Ids; readonly ranges: Ids },
) {
  return curated.brands.flatMap(({ brand, paints }) =>
    paints.map((paint, position) => {
      const { status, colorChoice } = paint;
      const replacementChoice =
        status.kind === "discontinued" ? status.replacementChoice : null;
      return {
        catalogId: paint.id,
        brandId: idOf(ids.brands, brand.id),
        position,
        rangeId: idOf(ids.ranges, paint.rangeId),
        name: paint.name,
        aliases: [...paint.aliases],
        manufacturerCode: paint.manufacturerCode,
        type: paint.type,
        metallic: paint.metallic,
        statusKind: status.kind,
        replacementChoiceSourceId:
          replacementChoice === null
            ? null
            : idOf(ids.sources, replacementChoice.sourceId),
        replacementChoiceNote: replacementChoice?.note ?? null,
        colorChoiceSourceId:
          colorChoice === null ? null : idOf(ids.sources, colorChoice.sourceId),
        colorChoiceOrigin: colorChoice?.origin ?? null,
        colorChoiceHex: colorChoice?.hex ?? null,
        colorChoiceNote: colorChoice?.note ?? null,
        note: paint.note,
      };
    }),
  );
}

/** What belongs to a paint, and the tombstones. */
export function paintPartRecords(
  curated: Curated,
  tombstones: Tombstones,
  ids: { readonly sources: Ids; readonly reasons: Ids; readonly paints: Ids },
) {
  const paints = curated.brands.flatMap((brand) => brand.paints);
  return {
    paintKeys: paints.flatMap((paint) =>
      paint.keys.map((key, position) => ({
        paintId: idOf(ids.paints, paint.id),
        position,
        sourceId: idOf(ids.sources, key.sourceId),
        key: key.key,
      })),
    ),
    rejectedColors: paints.flatMap((paint) =>
      paint.rejectedColors.map((row, position) => ({
        paintId: idOf(ids.paints, paint.id),
        position,
        sourceId: idOf(ids.sources, row.sourceId),
        origin: row.origin,
        hex: row.hex,
        reasonId: idOf(ids.reasons, row.reasonId),
        note: row.note,
      })),
    ),
    tombstones: COLLECTIONS.flatMap((collection) =>
      tombstones[collection].map((tombstone, position) => ({
        collection,
        catalogId: tombstone.id,
        position,
        reason: tombstone.reason,
        remainingPaintId:
          "remainingPaintId" in tombstone && tombstone.remainingPaintId !== null
            ? idOf(ids.paints, tombstone.remainingPaintId)
            : null,
      })),
    ),
  };
}
