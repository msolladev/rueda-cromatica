import { readFileSync } from "node:fs";
import {
  buildPaintIndex,
  paintIdSchema,
  parseCatalog,
} from "@chromatic-wheel/domain";
import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, OVERALL } from "../../app/state.ts";
import { searchColor } from "./search.ts";

const parsed = parseCatalog(
  JSON.parse(
    readFileSync(
      new URL("../../../public/catalog.json", import.meta.url),
      "utf8",
    ),
  ),
);
if (!parsed.ok) throw new Error("catalog.json is not valid");
const catalog = parsed.value;
const index = buildPaintIndex(catalog);
const base = { role: "base" as const, hex: "#3daf44" };
const three = () => 3;

describe("searchColor", () => {
  it("gives the closest paints of each brand, with what each row shows", () => {
    const results = searchColor(
      catalog,
      index,
      base,
      DEFAULT_PREFERENCES.filters,
      three,
    );
    expect(results.byBrand.map((brand) => brand.brandName)).toEqual([
      "AK Interactive",
      "Warhammer Colour",
      "The Army Painter",
      "Vallejo",
    ]);
    const citadel = results.byBrand[1];
    expect(citadel?.paints.map((paint) => paint.name)).toEqual([
      "Moot Green",
      "Sybarite Green",
      "Orruk Flesh",
    ]);
    expect(citadel?.hasMore).toBe(true);
    expect(citadel?.paints[0]).toMatchObject({
      rangeName: "Layer",
      type: "layer",
      quality: "near-identical",
      reasons: ["community-color"],
      origin: "community",
      sourceName: "SimoGecko",
      code: null,
    });
  });

  it("gives the closest of all brands together", () => {
    const results = searchColor(
      catalog,
      index,
      base,
      DEFAULT_PREFERENCES.filters,
      three,
    );
    expect(results.overall.map((paint) => paint.name)).toEqual([
      "Moot Green",
      "Ferocious Green",
      "Clear Green",
    ]);
  });

  it("shows more where «See more» asked for it", () => {
    const results = searchColor(
      catalog,
      index,
      base,
      DEFAULT_PREFERENCES.filters,
      (key) => (key === "vallejo" ? 6 : key === OVERALL ? 4 : 3),
    );
    expect(
      results.byBrand.find((brand) => brand.brandId === "vallejo")?.paints,
    ).toHaveLength(6);
    expect(
      results.byBrand.find((brand) => brand.brandId === "citadel")?.paints,
    ).toHaveLength(3);
    expect(results.overall).toHaveLength(4);
  });

  it("leaves out the brands the user turned off", () => {
    const filters = {
      ...DEFAULT_PREFERENCES.filters,
      excludedBrands: ["citadel", "vallejo"],
    };
    const results = searchColor(catalog, index, base, filters, three);
    expect(results.byBrand.map((brand) => brand.brandId)).toEqual([
      "ak-interactive",
      "the-army-painter",
    ]);
  });

  it("adds the types the user asked for", () => {
    const filters = {
      ...DEFAULT_PREFERENCES.filters,
      extraTypes: ["technical" as const, "contrast" as const],
    };
    const citadel = searchColor(catalog, index, base, filters, three)
      .byBrand[1];
    // docs/06 §6.1: Moot Green, Tesseract Glow (technical), Hexwraith Flame (contrast).
    expect(citadel?.paints.map((paint) => paint.name)).toEqual([
      "Moot Green",
      "Tesseract Glow",
      "Hexwraith Flame",
    ]);
  });

  it("puts the chosen paint first in its brand and marks it", () => {
    const results = searchColor(
      catalog,
      index,
      base,
      DEFAULT_PREFERENCES.filters,
      three,
      paintIdSchema.parse("vallejo/game-color/hammered-copper"),
    );
    const vallejo = results.byBrand.find(
      (brand) => brand.brandId === "vallejo",
    );
    expect(vallejo?.paints[0]?.name).toBe("Hammered Copper");
    expect(vallejo?.paints[0]?.chosen).toBe(true);
    expect(results.overall[0]?.name).toBe("Hammered Copper");
    expect(vallejo?.paints.slice(1).some((paint) => paint.chosen)).toBe(false);
  });
});
