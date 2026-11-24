import {
  readCurated,
  readTombstonesFile,
  type Curated,
  type RawFile,
  type Tombstones,
} from "@chromatic-wheel/catalog-builder";
import {
  readCuratedFiles,
  type CuratedFiles,
} from "@chromatic-wheel/catalog-builder/data";
import { hexColorSchema } from "@chromatic-wheel/domain";
import { beforeAll, describe, expect, it } from "vitest";
import {
  draftFiles,
  paintPartRecords,
  paintRecords,
  rootRecords,
  sourceAndRangeRecords,
  type DraftTables,
  type Ids,
} from "./draft-rows.ts";

/**
 * Writes the curated data to tables in memory, as `DraftService` does to the
 * database: every row gets an internal ID, and what points to it, that ID.
 */
function toTables(curated: Curated, tombstones: Tombstones): DraftTables {
  let next = 1n;
  const withIds = <T extends object>(rows: readonly T[]) =>
    rows.map((row) => ({ id: next++, ...row }));
  const idsBy = <T extends { id: bigint }>(
    rows: readonly T[],
    key: (row: T) => string,
  ): Ids => new Map(rows.map((row) => [key(row), row.id]));

  const roots = rootRecords(curated);
  const reasons = withIds(roots.reasons);
  const sources = withIds(roots.sources);
  const brands = withIds(roots.brands);
  const ids = {
    reasons: idsBy(reasons, (row) => row.slug),
    sources: idsBy(sources, (row) => row.catalogId),
    brands: idsBy(brands, (row) => row.catalogId),
  };
  const parts = sourceAndRangeRecords(curated, ids);
  const ranges = withIds(parts.ranges);
  const paints = withIds(
    paintRecords(curated, {
      ...ids,
      ranges: idsBy(ranges, (row) => row.catalogId),
    }),
  );
  const paintParts = paintPartRecords(curated, tombstones, {
    ...ids,
    paints: idsBy(paints, (row) => row.catalogId),
  });
  return {
    reasons,
    sources,
    brands,
    downloads: withIds(parts.downloads),
    rows: withIds(parts.rows),
    equivalences: withIds(parts.equivalences),
    replacements: withIds(parts.replacements),
    ignoredGroups: withIds(parts.ignoredGroups),
    ignoredKeys: withIds(parts.ignoredKeys),
    colorPolicy: withIds(parts.colorPolicy),
    ranges,
    paints,
    paintKeys: withIds(paintParts.paintKeys),
    rejectedColors: withIds(paintParts.rejectedColors),
    tombstones: withIds(paintParts.tombstones),
  };
}

function validated(files: CuratedFiles) {
  const curated = readCurated(files.data);
  const tombstones = readTombstonesFile(files.tombstones);
  if (!curated.ok || !tombstones.ok) throw new Error("Invalid curated data");
  return { curated: curated.value, tombstones: tombstones.value };
}

const contents = (files: readonly RawFile[]) =>
  files.map(({ name, content }) => ({ name, content }));

let files: CuratedFiles;

beforeAll(async () => {
  const read = await readCuratedFiles();
  if (!read.ok) throw new Error(read.error.join("\n"));
  files = read.value;
});

describe("the draft tables (ADR-0043)", () => {
  it("give back every file of data/ as it is, in its order", () => {
    const { curated, tombstones } = validated(files);
    const back = draftFiles(toTables(curated, tombstones));
    expect(contents(back.data.sources)).toEqual(contents(files.data.sources));
    expect(contents(back.data.brands)).toEqual(contents(files.data.brands));
    expect(back.data.ignoreReasons).toEqual(files.data.ignoreReasons);
    expect(back.data.colorPolicy).toEqual(files.data.colorPolicy);
    expect(back.tombstones).toEqual(files.tombstones);
  });

  it("keep a tombstone's remaining paint and a colour choice", () => {
    const { curated, tombstones } = validated(files);
    const [brand] = curated.brands;
    const [first, second] = brand?.paints ?? [];
    if (brand === undefined || first === undefined || second === undefined) {
      throw new Error("The data has no paints");
    }
    const [key] = first.keys;
    if (key === undefined) throw new Error("A paint without keys");
    const choice = {
      sourceId: key.sourceId,
      origin: "community" as const,
      hex: hexColorSchema.parse("#000000"),
      note: "A choice, for the test.",
    };
    const changed: Curated = {
      ...curated,
      brands: [
        { ...brand, paints: [{ ...first, colorChoice: choice }, second] },
      ],
    };
    const tombstone = {
      id: "acme/core/retired",
      reason: "A duplicate, for the test.",
      remainingPaintId: second.id,
    };
    const back = draftFiles(
      toTables(changed, {
        ...tombstones,
        paints: [tombstone] as unknown as Tombstones["paints"],
      }),
    );
    const content = back.data.brands[0]?.content as {
      paints: readonly { colorChoice: unknown }[];
    };
    expect(content.paints[0]?.colorChoice).toEqual(choice);
    expect(back.tombstones.content).toMatchObject({ paints: [tombstone] });
  });
});
