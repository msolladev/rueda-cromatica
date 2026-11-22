import { createHash } from "node:crypto";
import { parseCatalog } from "@chromatic-wheel/domain";
import { describe, expect, it } from "vitest";
import {
  acmeFile,
  curatedData,
  globexFile,
  patchPaint,
  row,
} from "../fixtures.ts";
import { buildCatalog, type CuratedData } from "./build-catalog.ts";

const data = curatedData;

function built(input: CuratedData) {
  const result = buildCatalog(input);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

function issues(input: CuratedData) {
  const result = buildCatalog(input);
  if (result.ok) throw new Error("Expected the build to fail");
  return result.error;
}

describe("buildCatalog", () => {
  it("assembles every brand file into a valid catalog", () => {
    const { document, json } = built(data());
    expect(document.brands.map((b) => b.id)).toEqual(["acme", "globex"]);
    expect(document.equivalences).toEqual([]);
    expect(parseCatalog(JSON.parse(json)).ok).toBe(true);
  });

  it("sorts collections by ID (docs/02 §1)", () => {
    const { document } = built(data());
    expect(document.paints.map((p) => p.id)).toEqual([
      "acme/core/blue",
      "acme/core/red",
      "globex/standard/green",
    ]);
  });

  it("takes each paint's colour from its row, with its source's origin", () => {
    const { document } = built(data());
    expect(document.paints.map((p) => p.color)).toEqual([
      { hex: "#0000aa", origin: "manufacturer", sourceId: "acme-chart" },
      { hex: "#aa0000", origin: "manufacturer", sourceId: "acme-chart" },
      null,
    ]);
  });

  it("publishes every source, without its rows or ignores", () => {
    const { document } = built(data());
    expect(document.sources.map((s) => s.id)).toEqual(["acme-chart"]);
    expect(Object.keys(document.sources[0] ?? {})).not.toContain("paints");
  });

  it("publishes the curated paint without its keys or note", () => {
    const { document } = built(data());
    expect(Object.keys(document.paints[0] ?? {})).toEqual([
      "id",
      "rangeId",
      "name",
      "aliases",
      "manufacturerCode",
      "type",
      "metallic",
      "color",
      "status",
    ]);
  });

  describe("determinism", () => {
    it("produces the same bytes whatever the input order", () => {
      const reversed = data();
      const acme = acmeFile();
      acme.content.paints.reverse();
      const shuffled = { ...reversed, brands: [globexFile(), acme] };
      expect(built(shuffled).json).toBe(built(data()).json);
    });

    it("produces the same bytes on every run", () => {
      expect(built(data()).json).toBe(built(data()).json);
    });

    it("serialises with 2-space indentation and a final newline", () => {
      const { document, json } = built(data());
      expect(json).toBe(`${JSON.stringify(document, null, 2)}\n`);
      expect(json.startsWith('{\n  "meta": {\n    "schemaVersion": 1,')).toBe(
        true,
      );
    });
  });

  describe("dataVersion (docs/02 §4)", () => {
    it("is the SHA-256 of the compact JSON of everything but meta", () => {
      const { document } = built(data());
      const { meta, ...body } = document;
      const expected = createHash("sha256")
        .update(JSON.stringify(body))
        .digest("hex");
      expect(meta.dataVersion).toBe(`sha256:${expected}`);
    });

    it("changes when the data changes", () => {
      const changed = data();
      const acme = acmeFile();
      patchPaint(acme, 0, { name: "Crimson" });
      const before = built(data()).document.meta.dataVersion;
      const after = built({ ...changed, brands: [acme, globexFile()] }).document
        .meta.dataVersion;
      expect(after).not.toBe(before);
    });
  });

  describe("issues", () => {
    it("collects the issues of every file before failing", () => {
      const acme = acmeFile();
      acme.content.brand.id = "acme-paints";
      const result = issues({
        ...data(),
        sources: [{ name: "sources/acme-chart.json", content: {} }],
        brands: [acme, { name: "brands/globex.json", content: [] }],
      });
      expect([...new Set(result.map((issue) => issue.file))]).toEqual([
        "sources/acme-chart.json",
        "brands/acme.json",
        "brands/globex.json",
      ]);
    });

    it("fails on a key resolution issue", () => {
      const input = data();
      input.sources[0]?.content.paints.push(row({ key: "AC-04" }));
      expect(issues(input).map((i) => `${i.file} ${i.path}`)).toEqual([
        "sources/acme-chart.json paints[5]",
      ]);
    });

    it("fails on a source that gives colours but has no origin", () => {
      const input = {
        ...data(),
        colorPolicy: {
          ...data().colorPolicy,
          content: { measured: [], manufacturer: [], community: [] },
        },
      };
      expect(issues(input).map((i) => i.message)).toEqual([
        "acme-chart gives colours but is neither in manufacturer nor in community",
      ]);
    });

    it("fails on a paint with several colour candidates", () => {
      const input = data();
      const [source] = input.sources;
      if (source === undefined) throw new Error("Fixture without sources");
      source.content.paints[0] = row({
        key: "AC-01",
        name: "Red",
        measuredHex: "#ab0101",
      });
      input.colorPolicy = {
        ...input.colorPolicy,
        content: {
          measured: ["acme-chart"],
          manufacturer: ["acme-chart"],
          community: [],
        },
      };
      expect(issues(input).map((i) => `${i.file} ${i.path}`)).toEqual([
        "brands/acme.json paints[0]",
      ]);
    });

    it("locates catalog integrity issues in the file that holds the data", () => {
      const acme = acmeFile();
      patchPaint(acme, 1, { aliases: ["Blue"] });
      expect(
        issues({ ...data(), brands: [acme, globexFile()] }).map(
          (i) => `${i.file} ${i.path}`,
        ),
      ).toEqual(["brands/acme.json paints[1].aliases[0]"]);
    });

    it("reports a paint ID repeated in two brand files", () => {
      const input = data();
      const globex = globexFile();
      // An Acme ID filed under a Globex range: valid per file, duplicate overall.
      const [green] = globex.content.paints;
      if (green === undefined) throw new Error("Fixture without paints");
      globex.content.paints.push({
        ...green,
        id: "acme/core/red",
        keys: [{ sourceId: "acme-chart", key: "AC-90" }],
      });
      input.sources[0]?.content.ignoredGroups.splice(0, 1);
      input.ignoreReasons = {
        ...input.ignoreReasons,
        content: [{ id: "auxiliary", text: "Product without colour." }],
      };
      const result = issues({ ...input, brands: [acmeFile(), globex] });
      expect(result.map((i) => `${i.file} ${i.path}`)).toEqual([
        "brands/globex.json paints[1].id",
      ]);
    });
  });
});
