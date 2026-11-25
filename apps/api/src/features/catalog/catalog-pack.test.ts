import { describe, expect, it } from "vitest";
import { formatCatalogPack, parseCatalogPack } from "./catalog-pack.ts";

const pack = {
  files: {
    tombstones: { name: "tombstones.json", content: { tombstones: [] } },
    data: {
      ignoreReasons: { name: "ignore-reasons.json", content: [] },
      colorPolicy: { name: "color-policy.json", content: { order: ["a"] } },
      sources: [{ name: "sources/a.json", content: { id: "a" } }],
      brands: [{ name: "brands/b.json", content: { id: "b" } }],
    },
  },
  release: {
    tag: "release/2026-11-22.3",
    releasedAt: new Date("2026-11-22T18:04:05+01:00"),
    text: '{\n  "schemaVersion": 1\n}\n',
  },
};

describe("the catalog pack", () => {
  it("keeps the files, the release and its exact text", () => {
    const parsed = parseCatalogPack(formatCatalogPack(pack));
    expect(parsed).toEqual({ ok: true, value: pack });
  });

  it("travels the release date as an instant in UTC", () => {
    expect(formatCatalogPack(pack)).toContain(
      '"releasedAt":"2026-11-22T17:04:05.000Z"',
    );
  });

  it("may have no release yet", () => {
    const parsed = parseCatalogPack(
      formatCatalogPack({ ...pack, release: null }),
    );
    expect(parsed.ok && parsed.value.release).toBeNull();
  });

  it.each([
    ["a text that is not JSON", "{"],
    ["another format", JSON.stringify({ format: 2 })],
    [
      "a file without a name",
      formatCatalogPack(pack).replace('"name":"tombstones.json"', '"name":""'),
    ],
  ])("rejects %s", (_, text) => {
    expect(parseCatalogPack(text).ok).toBe(false);
  });
});
