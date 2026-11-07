import { describe, expect, it } from "vitest";
import {
  at,
  catalogOf,
  draftPaint,
  find,
  insertEdges,
  insertSorted,
  issuesOf,
  paintId,
  pathsOf,
  validDraft,
  type Draft,
} from "./fixtures.ts";
import { formatPath, parseCatalog } from "./parse.ts";
import { SUPPORTED_SCHEMA_VERSION } from "./schema.ts";

const integrity = (draft: Draft) => pathsOf(issuesOf(draft, "integrity"));
const structure = (draft: unknown) =>
  pathsOf(issuesOf(draft, "invalid-structure"));

describe("parseCatalog", () => {
  it("accepts a valid catalog", () => {
    const result = parseCatalog(validDraft());
    expect(result.ok).toBe(true);
  });

  it("accepts empty collections", () => {
    const draft = validDraft();
    draft.sources = [];
    draft.brands = [];
    draft.ranges = [];
    draft.paints = [];
    draft.equivalences = [];
    expect(parseCatalog(draft).ok).toBe(true);
  });

  describe("schema version", () => {
    it.each([
      ["a newer version", { meta: { schemaVersion: 2 } }, 2],
      ["a version as string", { meta: { schemaVersion: "1" } }, "1"],
    ])("rejects %s before checking the structure", (_, input, found) => {
      expect(parseCatalog(input)).toEqual({
        ok: false,
        error: {
          kind: "unsupported-schema-version",
          found,
          supported: SUPPORTED_SCHEMA_VERSION,
        },
      });
    });

    // A corrupt file must not be reported as "update the app".
    it.each([
      ["a missing meta", { sources: [] }],
      ["a meta without version", { meta: {} }],
      ["an empty object", {}],
      ["a non-object input", null],
    ])("reports %s as invalid structure", (_, input) => {
      const result = parseCatalog(input);
      expect(result.ok ? null : result.error.kind).toBe("invalid-structure");
    });
  });

  describe("structure", () => {
    it("reports issues with readable paths", () => {
      const draft = validDraft();
      const paint = find(draft.paints, "acme/core/deep-red");
      paint.color = { hex: "#8A1C1C", origin: "manufacturer", sourceId: "x" };
      expect(structure(draft)).toEqual(["paints[1].color.hex"]);
    });

    it.each([
      ["paint ID with two segments", ["paints", 0, "id"], "acme/old-red"],
      ["range ID with one segment", ["ranges", 0, "id"], "classic"],
      ["slug with uppercase", ["brands", 0, "id"], "Acme"],
      ["slug with trailing hyphen", ["sources", 0, "id"], "acme-"],
      ["unknown paint type", ["paints", 0, "type"], "primer"],
      ["unknown range status", ["ranges", 0, "status"], "retired"],
      ["unknown source kind", ["sources", 0, "kind"], "retailer"],
      ["unknown colour origin", ["paints", 1, "color", "origin"], "photo"],
      ["empty source title", ["sources", 0, "title"], ""],
      ["empty source publisher", ["sources", 0, "publisher"], ""],
      ["empty source license", ["sources", 0, "license"], ""],
      ["empty brand name", ["brands", 0, "name"], ""],
      ["empty range name", ["ranges", 0, "name"], ""],
      ["empty paint name", ["paints", 0, "name"], ""],
      ["empty manufacturer code", ["paints", 1, "manufacturerCode"], ""],
      ["impossible date", ["sources", 0, "retrievedAt"], "2026-02-30"],
      ["non-http URL", ["sources", 0, "url"], "ftp://example.com/a.pdf"],
      ["URL without slashes", ["sources", 0, "url"], "https:example.com/a.pdf"],
      [
        "archive URL without slashes",
        ["sources", 0, "archiveUrl"],
        "https:web.archive.org/web/2026/https://example.com/",
      ],
      [
        "archive outside the Wayback Machine",
        ["sources", 0, "archiveUrl"],
        "https://archive.ph/abc",
      ],
      ["empty attribution", ["sources", 0, "attribution"], ""],
      ["malformed dataVersion", ["meta", "dataVersion"], "sha256:abc"],
      ["missing field instead of null", ["paints", 0, "color"], undefined],
    ])("rejects a %s", (_, path, value) => {
      const draft = validDraft();
      setIn(draft, path, value);
      expect(structure(draft)).toEqual([formatPath(path)]);
    });

    it("drops unknown keys to tolerate future fields", () => {
      const draft = { ...validDraft(), extra: true };
      const result = parseCatalog(draft);
      expect(result.ok).toBe(true);
    });
  });

  describe("integrity", () => {
    it.each(["sources", "brands", "ranges", "paints"] as const)(
      "1. rejects duplicate IDs in %s",
      (collection) => {
        const draft = validDraft();
        const items: { id: string }[] = draft[collection];
        insertSorted(items, { ...at(items, 0) });
        expect(integrity(draft)).toEqual([`${collection}[1].id`]);
      },
    );

    describe("2. references", () => {
      it("rejects a range of an unknown brand", () => {
        const draft = validDraft();
        at(draft.ranges, 0).brandId = "missing";
        expect(integrity(draft)).toEqual(["ranges[0].brandId"]);
      });

      it("rejects a paint of an unknown range", () => {
        const draft = validDraft();
        insertSorted(
          draft.paints,
          draftPaint({ id: "acme/gone/blue", rangeId: "acme/gone" }),
        );
        expect(integrity(draft)).toEqual(["paints[2].rangeId"]);
      });

      it("rejects a colour from an unknown source", () => {
        const draft = validDraft();
        const color = find(draft.paints, "acme/core/deep-red").color;
        if (color) color.sourceId = "missing";
        expect(integrity(draft)).toEqual(["paints[1].color.sourceId"]);
      });

      it("rejects a replacement with unknown paint and source", () => {
        const draft = validDraft();
        find(draft.paints, "acme/classic/old-red").status = {
          kind: "discontinued",
          replacement: { paintId: "acme/core/missing", sourceId: "missing" },
        };
        expect(integrity(draft)).toEqual([
          "paints[0].status.replacement.paintId",
          "paints[0].status.replacement.sourceId",
        ]);
      });

      it("rejects an equivalence with unknown ends and source", () => {
        const draft = validDraft();
        draft.equivalences = [
          { from: "acme/core/a", to: "acme/core/b", sourceId: "missing" },
        ];
        expect(integrity(draft)).toEqual([
          "equivalences[0].from",
          "equivalences[0].to",
          "equivalences[0].sourceId",
        ]);
      });
    });

    it("3. rejects an active paint in a discontinued range", () => {
      const draft = validDraft();
      find(draft.paints, "acme/classic/old-red").status = { kind: "active" };
      expect(integrity(draft)).toEqual(["paints[0].status.kind"]);
    });

    describe("4. replacements", () => {
      it("rejects a paint that replaces itself", () => {
        const draft = validDraft();
        find(draft.paints, "acme/classic/old-red").status = {
          kind: "discontinued",
          replacement: {
            paintId: "acme/classic/old-red",
            sourceId: "acme-conversion-chart",
          },
        };
        expect(integrity(draft)).toEqual([
          "paints[0].status.replacement.paintId",
        ]);
      });

      it("reports each replacement cycle once", () => {
        const draft = validDraft();
        const replacedBy = (paintId: string) =>
          ({
            kind: "discontinued",
            replacement: { paintId, sourceId: "acme-conversion-chart" },
          }) as const;
        insertSorted(
          draft.paints,
          draftPaint({
            id: "acme/classic/a",
            rangeId: "acme/classic",
            status: replacedBy("acme/classic/b"),
          }),
          draftPaint({
            id: "acme/classic/b",
            rangeId: "acme/classic",
            status: replacedBy("acme/classic/c"),
          }),
          draftPaint({
            id: "acme/classic/c",
            rangeId: "acme/classic",
            status: replacedBy("acme/classic/a"),
          }),
          // Leads into the cycle without being part of it.
          draftPaint({
            id: "acme/classic/d",
            rangeId: "acme/classic",
            status: replacedBy("acme/classic/a"),
          }),
        );
        const issues = issuesOf(draft, "integrity");
        expect(issues).toEqual([
          {
            path: "paints[0].status.replacement.paintId",
            message:
              "Replacement cycle: acme/classic/a → acme/classic/b → acme/classic/c → acme/classic/a",
          },
        ]);
      });
    });

    describe("5. manufacturer sources", () => {
      it("rejects a replacement backed by a third party", () => {
        const draft = validDraft();
        find(draft.paints, "acme/classic/old-red").status = {
          kind: "discontinued",
          replacement: {
            paintId: "acme/core/deep-red",
            sourceId: "community-hex",
          },
        };
        expect(integrity(draft)).toEqual([
          "paints[0].status.replacement.sourceId",
        ]);
      });

      it("rejects an equivalence backed by a third party", () => {
        const draft = validDraft();
        at(draft.equivalences, 0).sourceId = "community-hex";
        expect(integrity(draft)).toEqual(["equivalences[0].sourceId"]);
      });
    });

    describe("6. equivalences", () => {
      it("rejects an edge from a paint to itself", () => {
        const draft = validDraft();
        at(draft.equivalences, 0).to = "acme/core/deep-red";
        expect(integrity(draft)).toEqual(["equivalences[0].to"]);
      });

      it("rejects a repeated (from, to, sourceId)", () => {
        const draft = validDraft();
        draft.equivalences.push({ ...at(draft.equivalences, 0) });
        expect(integrity(draft)).toEqual(["equivalences[1]"]);
      });

      it("accepts the same edge from another source and its inverse", () => {
        const draft = validDraft();
        insertSorted(draft.sources, {
          ...at(draft.sources, 0),
          id: "acme-chart-2",
        });
        insertEdges(
          draft.equivalences,
          { ...at(draft.equivalences, 0), sourceId: "acme-chart-2" },
          {
            from: "globex/standard/crimson",
            to: "acme/core/deep-red",
            sourceId: "acme-conversion-chart",
          },
        );
        expect(parseCatalog(draft).ok).toBe(true);
      });
    });

    describe("7. aliases", () => {
      it.each([
        ["brands", 0, "Acme Paints"],
        ["paints", 2, "Crimson"],
      ] as const)("rejects an alias that repeats the name in %s", (c, i, n) => {
        const draft = validDraft();
        at<{ aliases: string[] }>(draft[c], i).aliases.push(n);
        expect(integrity(draft)).toEqual([`${c}[${String(i)}].aliases[1]`]);
      });

      it.each([
        ["brands", 0, "Acme"],
        ["paints", 2, "Old Crimson"],
      ] as const)("rejects a duplicate alias in %s", (c, i, alias) => {
        const draft = validDraft();
        at<{ aliases: string[] }>(draft[c], i).aliases.push(alias);
        expect(integrity(draft)).toEqual([`${c}[${String(i)}].aliases[1]`]);
      });
    });

    it("8. rejects an archived copy of a source without URL", () => {
      const draft = validDraft();
      find(draft.sources, "community-hex").archiveUrl =
        "https://web.archive.org/web/2026/https://example.com/";
      expect(integrity(draft)).toEqual(["sources[1].archiveUrl"]);
    });

    describe("9. order", () => {
      it("rejects a collection not sorted by ID", () => {
        const draft = validDraft();
        draft.paints.reverse();
        expect(integrity(draft)).toEqual(["paints[1].id", "paints[2].id"]);
      });

      it("rejects equivalences not sorted by (from, to, sourceId)", () => {
        const draft = validDraft();
        draft.equivalences.unshift({
          from: "globex/standard/crimson",
          to: "acme/core/deep-red",
          sourceId: "acme-conversion-chart",
        });
        expect(integrity(draft)).toEqual(["equivalences[1]"]);
      });
    });

    it("collects every violation instead of stopping at the first", () => {
      const draft = validDraft();
      at(draft.ranges, 0).brandId = "missing";
      find(draft.paints, "acme/classic/old-red").status = { kind: "active" };
      at(draft.equivalences, 0).sourceId = "community-hex";
      draft.brands.push({ ...at(draft.brands, 1) });
      expect(integrity(draft)).toEqual([
        "brands[2].id",
        "ranges[0].brandId",
        "paints[0].status.kind",
        "equivalences[0].sourceId",
      ]);
    });
  });

  it("returns deeply frozen data", () => {
    const catalog = catalogOf(validDraft());
    const paint = catalog.paint(paintId("acme/core/deep-red"));
    expect(Object.isFrozen(paint)).toBe(true);
    expect(Object.isFrozen(paint?.color)).toBe(true);
    expect(Object.isFrozen(paint?.aliases)).toBe(true);
    expect(Object.isFrozen(catalog.brands())).toBe(true);
  });
});

function setIn(
  target: object,
  path: readonly (string | number)[],
  value: unknown,
) {
  let node: Record<string | number, unknown> = target as Record<
    string,
    unknown
  >;
  for (const key of path.slice(0, -1)) {
    node = node[key] as Record<string | number, unknown>;
  }
  const last = at(path, path.length - 1);
  if (value === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- test helper
    delete node[last];
  } else {
    node[last] = value;
  }
}
