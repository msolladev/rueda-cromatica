import { createHash } from "node:crypto";
import { parseCatalog } from "@chromatic-wheel/domain";
import { describe, expect, it } from "vitest";
import {
  acmeFile,
  curatedData,
  globexFile,
  type Fixtures,
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

  describe("several colour candidates (ADR-0031)", () => {
    /** Red gets a measured hex: blue, far from its red chart hex. */
    const withMeasured = (measuredHex: string) => {
      const input = data();
      const [source] = input.sources;
      if (source === undefined) throw new Error("Fixture without sources");
      source.content.paints[0] = row({
        key: "AC-01",
        name: "Red",
        hex: "#AA0000",
        measuredHex,
      });
      input.colorPolicy.content.measured = ["acme-chart"];
      return input;
    };

    it("publishes the best candidate by priority", () => {
      const { document } = built(withMeasured("#0000aa"));
      expect(
        document.paints.find((p) => p.id === "acme/core/red")?.color,
      ).toEqual({ hex: "#0000aa", origin: "measured", sourceId: "acme-chart" });
    });

    it("reports a losing candidate that is not similar (ΔE > 5)", () => {
      const { discrepancies, discrepanciesJson } = built(
        withMeasured("#0000aa"),
      );
      expect(discrepancies).toEqual([
        {
          paintId: "acme/core/red",
          published: {
            hex: "#0000aa",
            origin: "measured",
            sourceId: "acme-chart",
          },
          other: {
            hex: "#aa0000",
            origin: "manufacturer",
            sourceId: "acme-chart",
          },
          deltaE2000: expect.any(Number) as number,
        },
      ]);
      expect(discrepancies[0]?.deltaE2000).toBeGreaterThan(5);
      expect(discrepanciesJson).toBe(
        `${JSON.stringify(discrepancies, null, 2)}\n`,
      );
    });

    it("does not report a similar candidate, nor a rejected one", () => {
      expect(built(withMeasured("#ab0101")).discrepancies).toEqual([]);
      const input = withMeasured("#0000aa");
      const [acme] = input.brands;
      if (acme === undefined) throw new Error("Fixture without brands");
      patchPaint(acme, 0, {
        rejectedColors: [
          {
            sourceId: "acme-chart",
            origin: "manufacturer",
            hex: "#aa0000",
            reasonId: "auxiliary",
            note: null,
          },
        ],
      });
      const { document, discrepancies } = built(input);
      expect(discrepancies).toEqual([]);
      expect(
        document.paints.find((p) => p.id === "acme/core/red")?.color?.hex,
      ).toBe("#0000aa");
    });
  });

  describe("disabled sources (ADR-0015, ADR-0032)", () => {
    /**
     * A second fictitious source, a community forum that also gives Red, and
     * one of the two sources disabled.
     */
    const withForum = (disabled: "acme-chart" | "hooli-forum") => {
      const input = data();
      const [acme] = input.sources;
      if (acme === undefined) throw new Error("Fixture without sources");
      input.sources.push({
        name: "sources/hooli-forum.json",
        content: {
          ...acme.content,
          source: {
            ...acme.content.source,
            id: "hooli-forum",
            kind: "third-party",
            title: "Hooli paint forum",
            publisher: "Hooli",
            url: "https://example.com/hooli",
          },
          paints: [row({ key: "Red", name: "Red", hex: "#BB1111" })],
          ignoredGroups: [],
          ignoredKeys: [],
        },
      });
      input.colorPolicy.content.community = ["hooli-forum"];
      const [brand] = input.brands;
      if (brand === undefined) throw new Error("Fixture without brands");
      patchPaint(brand, 0, {
        keys: [
          { sourceId: "acme-chart", key: "AC-01" },
          { sourceId: "hooli-forum", key: "Red" },
        ],
      });
      const source = input.sources.find(
        (s) => s.content.source.id === disabled,
      );
      if (source === undefined) throw new Error(`No source ${disabled}`);
      source.content.disabled = { note: "Fictitious reason." };
      return input;
    };

    it("leaves the source out of the catalog and its colours to the next candidate or null", () => {
      const { document } = built(withForum("acme-chart"));
      expect(document.sources.map((s) => s.id)).toEqual(["hooli-forum"]);
      expect(document.paints.map((p) => [p.id, p.color])).toEqual([
        ["acme/core/blue", null],
        [
          "acme/core/red",
          { hex: "#bb1111", origin: "community", sourceId: "hooli-forum" },
        ],
        ["globex/standard/green", null],
      ]);
    });

    it("keeps every paint ID", () => {
      const ids = (input: CuratedData) =>
        built(input).document.paints.map((p) => p.id);
      expect(ids(withForum("acme-chart"))).toEqual(ids(data()));
    });

    it("summarises what the build would publish with the source enabled", () => {
      const { disabledSources, disabledSourcesJson } = built(
        withForum("acme-chart"),
      );
      const acme = (hex: string) => ({
        hex,
        origin: "manufacturer",
        sourceId: "acme-chart",
      });
      expect(disabledSources).toEqual({
        disabledSources: ["acme-chart"],
        colors: [
          {
            paintId: "acme/core/blue",
            published: null,
            ifEnabled: acme("#0000aa"),
            deltaE2000: null,
          },
          {
            paintId: "acme/core/red",
            published: {
              hex: "#bb1111",
              origin: "community",
              sourceId: "hooli-forum",
            },
            ifEnabled: acme("#aa0000"),
            deltaE2000: expect.any(Number) as number,
          },
        ],
        equivalences: [],
        replacements: [],
      });
      expect(disabledSourcesJson).toBe(
        `${JSON.stringify(disabledSources, null, 2)}\n`,
      );
    });

    it("summarises nothing when disabling changes no colour", () => {
      expect(built(withForum("hooli-forum")).disabledSources).toEqual({
        disabledSources: ["hooli-forum"],
        colors: [],
        equivalences: [],
        replacements: [],
      });
      expect(built(data()).disabledSources).toEqual({
        disabledSources: [],
        colors: [],
        equivalences: [],
        replacements: [],
      });
    });

    it("fails on a rejection or a choice of a disabled source (ADR-0019, 4)", () => {
      const input = withForum("hooli-forum");
      const [brand] = input.brands;
      if (brand === undefined) throw new Error("Fixture without brands");
      patchPaint(brand, 0, {
        rejectedColors: [
          {
            sourceId: "hooli-forum",
            origin: "community",
            hex: "#bb1111",
            reasonId: "auxiliary",
            note: null,
          },
        ],
      });
      expect(issues(input)).toEqual([
        {
          file: "brands/acme.json",
          path: "paints[0].rejectedColors[0]",
          message: "hooli-forum is disabled; remove the stale rejection",
        },
      ]);
    });
  });

  describe("replacements (ADR-0005, ADR-0019 decision 1)", () => {
    const discontinued = (
      replacementChoice: { sourceId: string; note: string } | null = null,
    ) => ({ status: { kind: "discontinued" as const, replacementChoice } });

    /**
     * Acme discontinues its Red and says that Globex Green replaces it. With
     * `hooli`, a second manufacturer document says that Acme Blue does.
     */
    const withReplacement = (
      hooli: "none" | "enabled" | "disabled" = "none",
    ) => {
      const input = data();
      const acme = input.sources[0]?.content;
      const [acmeBrand] = input.brands;
      if (acme === undefined || acmeBrand === undefined) {
        throw new Error("Fixture without sources or brands");
      }
      acme.replacements = [{ from: "AC-01", to: "GX-01", note: null }];
      patchPaint(acmeBrand, 1, discontinued());
      if (hooli !== "none") {
        input.sources.push({
          name: "sources/hooli-chart.json",
          content: {
            ...acme,
            source: { ...acme.source, id: "hooli-chart", title: "Hooli chart" },
            disabled: hooli === "disabled" ? { note: "Under review." } : null,
            paints: [
              row({ key: "R", group: "Acme", name: "Red", hex: null }),
              row({ key: "B", group: "Acme", name: "Blue", hex: null }),
            ],
            replacements: [{ from: "R", to: "B", note: null }],
            ignoredGroups: [],
            ignoredKeys: [],
          },
        });
        patchPaint(acmeBrand, 0, {
          keys: [
            { sourceId: "acme-chart", key: "AC-01" },
            { sourceId: "hooli-chart", key: "R" },
          ],
        });
        patchPaint(acmeBrand, 1, {
          ...discontinued(),
          keys: [
            { sourceId: "acme-chart", key: "AC-02" },
            { sourceId: "hooli-chart", key: "B" },
          ],
        });
      }
      return input;
    };

    /** Acme Red is index 0 of the Acme brand file. */
    const choose = (input: Fixtures, sourceId: string) => {
      const [acmeBrand] = input.brands;
      if (acmeBrand === undefined) throw new Error("Fixture without brands");
      patchPaint(acmeBrand, 0, discontinued({ sourceId, note: "Reviewed." }));
      return input;
    };

    const statusOf = (input: Fixtures, id: string) =>
      built(input).document.paints.find((p) => p.id === id)?.status;

    it("publishes the replacement that the manufacturer document states", () => {
      const input = withReplacement();
      const [acmeBrand] = input.brands;
      if (acmeBrand === undefined) throw new Error("Fixture without brands");
      patchPaint(acmeBrand, 0, discontinued());
      expect(statusOf(input, "acme/core/red")).toEqual({
        kind: "discontinued",
        replacement: {
          paintId: "globex/standard/green",
          sourceId: "acme-chart",
        },
      });
      expect(statusOf(input, "acme/core/blue")).toEqual({
        kind: "discontinued",
        replacement: null,
      });
    });

    it("fails if the replaced paint is still active", () => {
      expect(issues(withReplacement())).toEqual([
        expect.objectContaining({
          file: "brands/acme.json",
          path: "paints[0].status",
          message: expect.stringContaining("mark it discontinued") as string,
        }),
      ]);
    });

    it("fails if two documents name different replacements, until one is chosen", () => {
      const input = withReplacement("enabled");
      const [acmeBrand] = input.brands;
      if (acmeBrand === undefined) throw new Error("Fixture without brands");
      patchPaint(acmeBrand, 0, discontinued());
      expect(issues(input)).toEqual([
        expect.objectContaining({
          path: "paints[0].status",
          message:
            "The documents name different replacements: globex/standard/green (acme-chart), acme/core/blue (hooli-chart); choose one with replacementChoice",
        }),
      ]);
      expect(statusOf(choose(input, "hooli-chart"), "acme/core/red")).toEqual({
        kind: "discontinued",
        replacement: { paintId: "acme/core/blue", sourceId: "hooli-chart" },
      });
    });

    it("fails if the choice is not needed", () => {
      expect(issues(choose(withReplacement(), "acme-chart"))).toEqual([
        expect.objectContaining({
          path: "paints[0].status.replacementChoice",
          message: expect.stringContaining(
            "do not contradict each other",
          ) as string,
        }),
      ]);
    });

    it("leaves out the replacement of a disabled source, and lists it", () => {
      const input = withReplacement("disabled");
      const [acmeBrand] = input.brands;
      if (acmeBrand === undefined) throw new Error("Fixture without brands");
      // Only the disabled document names one for Blue.
      input.sources[1]?.content.replacements.splice(0, 1, {
        from: "B",
        to: "R",
        note: null,
      });
      patchPaint(acmeBrand, 0, discontinued());
      const { document, disabledSources } = built(input);
      expect(
        document.paints.find((p) => p.id === "acme/core/blue")?.status,
      ).toEqual({ kind: "discontinued", replacement: null });
      expect(disabledSources.replacements).toEqual([
        {
          paintId: "acme/core/blue",
          published: null,
          ifEnabled: { paintId: "acme/core/red", sourceId: "hooli-chart" },
        },
      ]);
    });

    it("fails if the choice names a disabled source", () => {
      const input = choose(withReplacement("disabled"), "hooli-chart");
      expect(issues(input)).toEqual([
        expect.objectContaining({
          path: "paints[0].status.replacementChoice",
          message:
            "hooli-chart names no replacement for it; remove the choice (without it: globex/standard/green (acme-chart))",
        }),
      ]);
    });

    it("only takes replacements from a manufacturer document", () => {
      const input = withReplacement();
      const acme = input.sources[0]?.content;
      const [acmeBrand] = input.brands;
      if (acme === undefined || acmeBrand === undefined) {
        throw new Error("Fixture without sources or brands");
      }
      acme.source.kind = "third-party";
      patchPaint(acmeBrand, 0, discontinued());
      expect(issues(input)).toContainEqual(
        expect.objectContaining({
          file: "sources/acme-chart.json",
          path: "replacements[0]",
          message: "Only a manufacturer document states replacements",
        }),
      );
    });
  });

  describe("official equivalences (ADR-0033)", () => {
    /** Acme says that its Red is Globex Green, and that its Air Red is too. */
    const withEquivalences = () => {
      const input = data();
      const acme = input.sources[0]?.content;
      if (acme === undefined) throw new Error("Fixture without sources");
      acme.equivalences = [
        { from: "AC-02", to: "GX-01", note: null },
        { from: "AC-90", to: "GX-01", note: null },
        { from: "AC-01", to: "GX-01", note: null },
      ];
      return input;
    };

    it("publishes each one whose two rows are keys, sorted", () => {
      const { document } = built(withEquivalences());
      expect(document.equivalences).toEqual([
        {
          from: "acme/core/blue",
          to: "globex/standard/green",
          sourceId: "acme-chart",
        },
        {
          from: "acme/core/red",
          to: "globex/standard/green",
          sourceId: "acme-chart",
        },
      ]);
    });

    it("leaves out those of a disabled source, and lists them", () => {
      const input = withEquivalences();
      const acme = input.sources[0]?.content;
      if (acme === undefined) throw new Error("Fixture without sources");
      // A second, disabled chart that repeats one equivalence of Acme.
      input.sources.push({
        name: "sources/hooli-chart.json",
        content: {
          ...acme,
          source: { ...acme.source, id: "hooli-chart", title: "Hooli chart" },
          disabled: { note: "Under review." },
          paints: [
            row({ key: "R", group: "Acme", name: "Red", hex: null }),
            row({ key: "G", group: "Globex", name: "Green", hex: null }),
          ],
          equivalences: [{ from: "G", to: "R", note: null }],
          ignoredGroups: [],
          ignoredKeys: [],
        },
      });
      const [acmeBrand, globexBrand] = input.brands;
      if (acmeBrand === undefined || globexBrand === undefined) {
        throw new Error("Fixture without brands");
      }
      patchPaint(acmeBrand, 0, {
        keys: [
          { sourceId: "acme-chart", key: "AC-01" },
          { sourceId: "hooli-chart", key: "R" },
        ],
      });
      patchPaint(globexBrand, 0, {
        keys: [
          { sourceId: "acme-chart", key: "GX-01" },
          { sourceId: "hooli-chart", key: "G" },
        ],
      });
      const { document, disabledSources } = built(input);
      expect(document.sources.map((s) => s.id)).toEqual(["acme-chart"]);
      expect(document.equivalences.map((e) => e.sourceId)).toEqual([
        "acme-chart",
        "acme-chart",
      ]);
      expect(disabledSources.equivalences).toEqual([
        {
          from: "globex/standard/green",
          to: "acme/core/red",
          sourceId: "hooli-chart",
        },
      ]);
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

    it("locates a colour correction issue in the paint that holds it", () => {
      const acme = acmeFile();
      patchPaint(acme, 0, {
        colorChoice: {
          sourceId: "acme-chart",
          origin: "manufacturer",
          hex: "#aa0000",
          note: "Fictitious reason.",
        },
      });
      expect(
        issues({ ...data(), brands: [acme, globexFile()] }).map(
          (i) => `${i.file} ${i.path}`,
        ),
      ).toEqual(["brands/acme.json paints[0].colorChoice"]);
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
