import { createHash } from "node:crypto";
import { parseCatalog } from "@chromatic-wheel/domain";
import { describe, expect, it } from "vitest";
import { acmeFile, globexFile, patchPaint, sourcesFile } from "../fixtures.ts";
import { buildCatalog, type CuratedData } from "./build-catalog.ts";

const data = (): CuratedData => ({
  sources: sourcesFile(),
  brands: [acmeFile(), globexFile()],
});

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
        sources: { name: "sources.json", content: {} },
        brands: [acme, { name: "globex.json", content: [] }],
      });
      expect(result.map((issue) => issue.file)).toEqual([
        "sources.json",
        "acme.json",
        "acme.json",
        "globex.json",
      ]);
    });

    it("locates catalog integrity issues in the file that holds the data", () => {
      const acme = acmeFile();
      patchPaint(acme, 1, {
        color: { hex: "#0000aa", origin: "manufacturer", sourceId: "missing" },
      });
      expect(issues({ ...data(), brands: [acme, globexFile()] })).toEqual([
        {
          file: "acme.json",
          path: "paints[1].color.sourceId",
          message: "Unknown source: missing",
        },
      ]);
    });

    it("reports a paint ID repeated in two brand files", () => {
      const globex = globexFile();
      // An Acme ID filed under a Globex range: valid per file, duplicate overall.
      const [green] = globex.content.paints;
      if (green === undefined) throw new Error("Fixture without paints");
      globex.content.paints.push({ ...green, id: "acme/core/red" });
      const result = issues({ ...data(), brands: [acmeFile(), globex] });
      expect(result.map((i) => `${i.file} ${i.path}`)).toEqual([
        "globex.json paints[1].id",
      ]);
    });
  });
});
