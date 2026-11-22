import { describe, expect, it } from "vitest";
import { catalogOf, find } from "../catalog/fixtures.ts";
import { realCatalog, realDraft } from "../matching/fixtures.ts";
import {
  buildPaintSearchIndex,
  isSearchable,
  MIN_QUERY_LENGTH,
  searchPaints,
} from "./paint-search.ts";

// Real paints of `catalog.json`.
const index = buildPaintSearchIndex(realCatalog());
const names = (query: string): string[] =>
  searchPaints(index, query).map((hit) => hit.paint.name);
const ids = (query: string): string[] =>
  searchPaints(index, query).map((hit) => hit.paint.id);

describe("isSearchable", () => {
  it("counts characters as a person does, without the spaces around", () => {
    expect(isSearchable("red")).toBe(true);
    expect(isSearchable("  re ")).toBe(false);
    // «é» written as «e» plus its accent is one character.
    expect(isSearchable("re\u0301")).toBe(false);
  });
});

describe("searchPaints", () => {
  it(`needs at least ${String(MIN_QUERY_LENGTH)} characters, without the spaces around`, () => {
    expect(searchPaints(index, "re")).toEqual([]);
    expect(searchPaints(index, "  re  ")).toEqual([]);
    expect(names("red").length).toBeGreaterThan(0);
  });

  it("finds by a fragment of the name, without capitals or accents", () => {
    expect(names("lothern")).toEqual(["Lothern Blue"]);
    expect(names("LOTHÉRN")).toEqual(["Lothern Blue"]);
  });

  it("ignores apostrophes and finds every word written, wherever it is", () => {
    expect(names("tigers skin")).toEqual([
      "Tiger's Eye Skin",
      "Tiger's Eye Skin",
    ]);
    expect(names("skin tiger's")).toEqual([
      "Tiger's Eye Skin",
      "Tiger's Eye Skin",
    ]);
  });

  it("puts the active paints before the discontinued ones of their group", () => {
    // Warpaints Fanatic is active; the original Warpaints, discontinued.
    expect(ids("tigers skin")).toEqual([
      "the-army-painter/warpaints-fanatic/tigers-eye-skin",
      "the-army-painter/warpaints/tigers-eye-skin",
    ]);
  });

  it("finds by the manufacturer code, without its separators", () => {
    expect(ids("70950")).toEqual(["vallejo/model-color/black"]);
    expect(ids("70.950")).toEqual(["vallejo/model-color/black"]);
    expect(ids("wp3152p")).toEqual([
      "the-army-painter/warpaints-fanatic/tigers-eye-skin",
    ]);
  });

  it("narrows by brand, also by its aliases, and by range", () => {
    const hits = searchPaints(index, "vallejo black");
    expect(hits.length).toBeGreaterThan(1);
    expect(hits.every((hit) => hit.brand.id === "vallejo")).toBe(true);
    expect(searchPaints(index, "citadel mephiston")).toHaveLength(1);
    expect(
      searchPaints(index, "xpress").every(
        (hit) => hit.range.id === "vallejo/xpress-color",
      ),
    ).toBe(true);
  });

  it("puts the exact name first, then the names that start with it, then words, then fragments", () => {
    const found = names("red");
    const first = found.indexOf("Red");
    const startsWith = found.indexOf("Red Leather");
    const word = found.indexOf("Mephiston Red");
    const fragment = found.findIndex((name) => /^[^ ]+red/iu.test(name));
    expect(first).toBe(0);
    expect(startsWith).toBeGreaterThan(first);
    expect(word).toBeGreaterThan(startsWith);
    expect(fragment).toBeGreaterThan(word);
  });

  it("puts the exact code first", () => {
    expect(ids("72.059")[0]).toBe("vallejo/game-color/hammered-copper");
  });

  it("orders each group by name, brand, range and ID", () => {
    const blacks = searchPaints(index, "black").filter(
      (hit) => hit.paint.name === "Black",
    );
    const brands = blacks.map((hit) => hit.brand.name.toLowerCase());
    expect(brands).toEqual([...brands].sort());
    expect(ids("black")).toEqual(ids("black"));
  });

  it("marks where the words are, in the original texts", () => {
    const [tiger] = searchPaints(index, "tigers skin");
    expect(tiger?.highlights.name).toEqual([
      { start: 0, end: 7 },
      { start: 12, end: 16 },
    ]);
    const [black] = searchPaints(index, "70950");
    expect(black?.highlights.code).toEqual([{ start: 0, end: 6 }]);
    const [vallejo] = searchPaints(index, "vallejo black");
    expect(vallejo?.highlights.brand).toEqual([{ start: 0, end: 7 }]);
  });

  it("finds paints without colour too, because whoever has one can start from it", () => {
    const draft = realDraft();
    const paint = find(draft.paints, "citadel/layer/lothern-blue");
    paint.color = null;
    const without = buildPaintSearchIndex(catalogOf(draft));
    expect(
      searchPaints(without, "lothern").map((hit) => hit.paint.color),
    ).toEqual([null]);
  });
});
