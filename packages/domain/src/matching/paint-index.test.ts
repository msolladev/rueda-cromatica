import { describe, expect, it } from "vitest";
import { find, insertSorted, draftPaint } from "../catalog/fixtures.ts";
import { indexOf, realCatalog, realDraft } from "./fixtures.ts";
import { buildPaintIndex } from "./paint-index.ts";

const indexedIds = (index: ReturnType<typeof buildPaintIndex>): string[] =>
  index.brands.flatMap(({ paints }) => paints.map(({ paint }) => paint.id));

describe("buildPaintIndex", () => {
  it("indexes every paint of the catalog, by brand in catalog order", () => {
    const catalog = realCatalog();
    const index = buildPaintIndex(catalog);
    expect(index.brands.map(({ brand }) => brand.id)).toEqual(
      catalog.brands().map((brand) => brand.id),
    );
    expect(indexedIds(index)).toEqual(
      catalog
        .paints({ brandIds: "all", includeDiscontinued: true })
        .map((paint) => paint.id),
    );
  });

  it("leaves out paints without colour", () => {
    const draft = realDraft();
    find(draft.paints, "citadel/layer/moot-green").color = null;
    expect(indexedIds(indexOf(draft))).not.toContain(
      "citadel/layer/moot-green",
    );
  });

  it("keeps discontinued paints, for the search to filter", () => {
    const draft = realDraft();
    find(draft.paints, "citadel/layer/moot-green").status = {
      kind: "discontinued",
      replacement: null,
    };
    expect(indexedIds(indexOf(draft))).toContain("citadel/layer/moot-green");
  });

  it("keeps a brand whose paints have no colour, with no paints", () => {
    const draft = realDraft();
    const ranges = new Set(
      draft.ranges
        .filter((range) => range.brandId === "vallejo")
        .map((range) => range.id),
    );
    for (const paint of draft.paints) {
      if (ranges.has(paint.rangeId)) paint.color = null;
    }
    const vallejo = indexOf(draft).brands.find(
      ({ brand }) => brand.id === "vallejo",
    );
    expect(vallejo?.paints).toEqual([]);
  });

  it("is unaffected by paints added without colour", () => {
    const draft = realDraft();
    insertSorted(
      draft.paints,
      draftPaint({
        id: "citadel/layer/aaa-no-colour",
        rangeId: "citadel/layer",
      }),
    );
    expect(indexedIds(indexOf(draft))).toEqual(
      indexedIds(indexOf(realDraft())),
    );
  });
});
