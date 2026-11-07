import { describe, expect, it } from "vitest";
import {
  at,
  brandId,
  catalogOf,
  draftPaint,
  insertSorted,
  paintId,
  validDraft,
} from "./fixtures.ts";
import { paintSchema, rangeIdSchema, sourceIdSchema } from "./schema.ts";

const ids = (items: readonly { readonly id: string }[]) =>
  items.map((item) => item.id);

describe("Catalog", () => {
  const catalog = catalogOf(validDraft());

  it("exposes the meta block", () => {
    expect(catalog.meta.schemaVersion).toBe(1);
  });

  it("looks entities up by ID", () => {
    expect(catalog.brand(brandId("acme"))?.name).toBe("Acme Paints");
    expect(catalog.range(rangeIdSchema.parse("acme/core"))?.name).toBe(
      "Acme Core",
    );
    expect(catalog.paint(paintId("acme/core/deep-red"))?.name).toBe("Deep Red");
    expect(catalog.source(sourceIdSchema.parse("community-hex"))?.kind).toBe(
      "third-party",
    );
    expect(catalog.paint(paintId("acme/core/missing"))).toBeUndefined();
  });

  it("lists brands and the ranges of a brand", () => {
    expect(ids(catalog.brands())).toEqual(["acme", "globex"]);
    expect(ids(catalog.rangesOf(brandId("acme")))).toEqual([
      "acme/classic",
      "acme/core",
    ]);
    expect(catalog.rangesOf(brandId("missing"))).toEqual([]);
  });

  describe("paints()", () => {
    it("filters by brand and hides discontinued paints when asked", () => {
      expect(
        ids(catalog.paints({ brandIds: "all", includeDiscontinued: true })),
      ).toEqual([
        "acme/classic/old-red",
        "acme/core/deep-red",
        "globex/standard/crimson",
      ]);
      expect(
        ids(
          catalog.paints({
            brandIds: [brandId("acme")],
            includeDiscontinued: false,
          }),
        ),
      ).toEqual(["acme/core/deep-red"]);
      expect(
        catalog.paints({ brandIds: [], includeDiscontinued: true }),
      ).toEqual([]);
    });

    it("groups by brand in catalog order, whatever the query order", () => {
      const draft = validDraft();
      // Its ID sorts first of all, but it belongs to Globex through its range.
      insertSorted(
        draft.paints,
        draftPaint({ id: "acme/basic/moved", rangeId: "globex/standard" }),
      );
      const query = {
        brandIds: [brandId("globex"), brandId("acme"), brandId("globex")],
        includeDiscontinued: true,
      };
      expect(ids(catalogOf(draft).paints(query))).toEqual([
        "acme/classic/old-red",
        "acme/core/deep-red",
        "acme/basic/moved",
        "globex/standard/crimson",
      ]);
    });
  });

  describe("brandOf()", () => {
    it("returns the brand through the range, not the ID prefix", () => {
      const draft = validDraft();
      // The paint moved to another brand's range after its ID was frozen.
      insertSorted(
        draft.paints,
        draftPaint({ id: "acme/core/moved", rangeId: "globex/standard" }),
      );
      const moved = catalogOf(draft);
      const paint = moved.paint(paintId("acme/core/moved"));
      if (!paint) throw new Error("Missing paint");
      expect(moved.brandOf(paint).id).toBe("globex");
    });

    it("throws for a paint from another catalog", () => {
      const foreign = paintSchema.parse(
        draftPaint({ id: "other/range/paint", rangeId: "other/range" }),
      );
      expect(() => catalog.brandOf(foreign)).toThrow();
    });

    it("throws for a foreign paint even if its range exists here", () => {
      const foreign = paintSchema.parse(
        draftPaint({ id: "acme/core/foreign", rangeId: "acme/core" }),
      );
      expect(() => catalog.brandOf(foreign)).toThrow();
    });
  });

  it("reads official equivalences only in their direction", () => {
    const deepRed = paintId("acme/core/deep-red");
    const crimson = paintId("globex/standard/crimson");
    expect(catalog.officialEquivalencesFrom(deepRed)).toEqual([
      at(validDraft().equivalences, 0),
    ]);
    expect(catalog.officialEquivalencesFrom(crimson)).toEqual([]);
    expect(catalog.officialEquivalencesTo(crimson).map((e) => e.from)).toEqual([
      "acme/core/deep-red",
    ]);
    expect(catalog.officialEquivalencesTo(deepRed)).toEqual([]);
  });
});
