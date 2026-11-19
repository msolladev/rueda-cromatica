import { describe, expect, it } from "vitest";
import { acmeFile, patchPaint, sourcesFile } from "../fixtures.ts";
import { readBrandFile, readSourcesFile, readTombstonesFile } from "./files.ts";

const paths = (result: ReturnType<typeof readBrandFile>) =>
  result.ok ? [] : result.error.map((issue) => `${issue.file} ${issue.path}`);

describe("readSourcesFile", () => {
  it("accepts an array of sources", () => {
    expect(readSourcesFile(sourcesFile()).ok).toBe(true);
  });

  it("rejects anything else, naming the file", () => {
    const result = readSourcesFile({ name: "sources.json", content: {} });
    expect(result.ok ? null : result.error[0]?.file).toBe("sources.json");
  });
});

describe("readBrandFile (docs/04 §2)", () => {
  it("accepts a brand file with its own ranges and paints", () => {
    expect(readBrandFile(acmeFile()).ok).toBe(true);
  });

  it("validates the entities with the catalog schemas", () => {
    const file = acmeFile();
    patchPaint(file, 0, {
      color: { hex: "#AA0000", origin: "manufacturer", sourceId: "acme-web" },
    });
    expect(paths(readBrandFile(file))).toEqual([
      "acme.json paints[0].color.hex",
    ]);
  });

  it("requires the file name to match the brand ID", () => {
    const file = { ...acmeFile(), name: "acme-paints.json" };
    expect(paths(readBrandFile(file))).toEqual(["acme-paints.json brand.id"]);
  });

  it("rejects a range of another brand", () => {
    const file = acmeFile();
    file.content.ranges.push({
      id: "globex/standard",
      brandId: "globex",
      name: "Globex Standard",
      status: "active",
    });
    expect(paths(readBrandFile(file))).toEqual(["acme.json ranges[1].brandId"]);
  });

  it("rejects a paint whose range is not in the file", () => {
    const file = acmeFile();
    patchPaint(file, 0, { rangeId: "globex/standard" });
    expect(paths(readBrandFile(file))).toEqual(["acme.json paints[0].rangeId"]);
  });
});

describe("readTombstonesFile (docs/03 §6)", () => {
  const file = (content: unknown) => ({ name: "tombstones.json", content });
  const empty = { sources: [], brands: [], ranges: [], paints: [] };
  const issuePaths = (content: unknown) => {
    const result = readTombstonesFile(file(content));
    return result.ok ? [] : result.error.map((issue) => issue.path);
  };

  it("accepts an ID and its reason per entry, by collection", () => {
    const result = readTombstonesFile(
      file({
        ...empty,
        paints: [{ id: "acme/core/purple", reason: "Registered twice." }],
      }),
    );
    expect(result.ok ? [...result.value.paints] : null).toEqual([
      "acme/core/purple",
    ]);
  });

  it("requires a reason", () => {
    expect(
      issuePaths({ ...empty, brands: [{ id: "initech", reason: " " }] }),
    ).toEqual(["brands[0].reason"]);
  });

  it("validates each ID with the format of its collection", () => {
    expect(
      issuePaths({
        ...empty,
        brands: [{ id: "acme/core", reason: "A range, not a brand." }],
      }),
    ).toEqual(["brands[0].id"]);
  });

  it("requires the four collections and nothing else", () => {
    expect(issuePaths({ paints: [], extra: [] })).toEqual([
      "sources",
      "brands",
      "ranges",
      "",
    ]);
  });

  it("rejects an ID tombstoned twice", () => {
    const entry = { id: "initech", reason: "Not a paint brand." };
    expect(issuePaths({ ...empty, brands: [entry, entry] })).toEqual([
      "brands[1].id",
    ]);
  });
});
