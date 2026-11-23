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
const base = { role: "base" as const, hex: "#5d9a32" };
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
      "Niblet Green",
      "Skarsnik Green",
    ]);
    expect(citadel?.hasMore).toBe(true);
    expect(citadel?.paints[0]).toMatchObject({
      rangeName: "Layer",
      type: "layer",
      quality: "identical",
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
      "Leafy Green",
      "Light Green",
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
    // docs/06 §6.1: Moot Green, Tesseract Glow (technical), Mantis Warriors Green (contrast).
    expect(citadel?.paints.map((paint) => paint.name)).toEqual([
      "Moot Green",
      "Tesseract Glow",
      "Mantis Warriors Green",
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

  it("gives no official equivalences without a chosen paint", () => {
    const results = searchColor(
      catalog,
      index,
      base,
      DEFAULT_PREFERENCES.filters,
      three,
    );
    expect(results.official).toBeNull();
  });

  it("gives the official equivalences of the chosen paint (docs/07 §16)", () => {
    const results = searchColor(
      catalog,
      index,
      { role: "base", hex: "#5d9a32" },
      DEFAULT_PREFERENCES.filters,
      three,
      paintIdSchema.parse("citadel/layer/moot-green"),
    );
    const official = results.official;
    expect(official).toMatchObject({
      name: "Moot Green",
      brandName: "Warhammer Colour",
      label: "Warhammer Colour · Layer",
      outgoing: [],
    });
    expect(
      official?.incoming.map(({ paint, sources }) => [
        paint.name,
        paint.brandName,
        paint.quality,
        sources.map((s) => s.publisher),
      ]),
    ).toEqual([
      ["Light Green", "AK Interactive", "similar", ["AK Interactive"]],
      [
        "Scorpion Green",
        "Warhammer Colour",
        "barely-similar",
        ["Games Workshop"],
      ],
      ["Leafy Green", "The Army Painter", "very-similar", ["The Army Painter"]],
      [
        "Snake Scales",
        "The Army Painter",
        "barely-similar",
        ["The Army Painter"],
      ],
      ["Scorpy Green", "Vallejo", "barely-similar", ["Acrylicos Vallejo"]],
    ]);
    expect(official).toMatchObject({
      discontinued: false,
      colorless: false,
      standIn: null,
      replacement: null,
    });
  });

  it("lists each row's official equivalences, for its «Details»", () => {
    const results = searchColor(
      catalog,
      index,
      { role: "base", hex: "#5d9a32" },
      DEFAULT_PREFERENCES.filters,
      three,
    );
    const moot = results.byBrand[1]?.paints[0];
    expect(moot?.name).toBe("Moot Green");
    expect(
      moot?.official.map((link) => [link.direction, link.name, link.code]),
    ).toEqual([
      ["incoming", "Light Green", "AK11141"],
      ["incoming", "Scorpion Green", "61-40"],
      ["incoming", "Leafy Green", "WP3056P"],
      ["incoming", "Snake Scales", "WP1453"],
      ["incoming", "Scorpy Green", "72.032"],
    ]);
  });

  describe("a chosen paint without colour (docs/07 §15-16)", () => {
    const snakeScales = paintIdSchema.parse(
      "the-army-painter/warpaints/snake-scales",
    );
    /**
     * The real catalog with the original Snake Scales without colour and, if
     * asked, replaced by Moot Green: fictitious, to test what the catalog
     * does not have yet.
     */
    const variant = (replaced: boolean) => {
      const document = JSON.parse(
        readFileSync(
          new URL("../../../public/catalog.json", import.meta.url),
          "utf8",
        ),
      ) as { paints: { id: string; color: unknown; status: unknown }[] };
      const paint = document.paints.find((p) => p.id === snakeScales);
      if (paint === undefined) throw new Error("No Snake Scales");
      paint.color = null;
      paint.status = {
        kind: "discontinued",
        replacement: replaced
          ? {
              paintId: "citadel/layer/moot-green",
              sourceId: "the-army-painter-warpaints-conversion-chart",
            }
          : null,
      };
      const result = parseCatalog(document);
      if (!result.ok) throw new Error("Invalid variant");
      const changed = result.value;
      return searchColor(
        changed,
        buildPaintIndex(changed),
        base,
        DEFAULT_PREFERENCES.filters,
        three,
        snakeScales,
      );
    };

    it("gives its replacement first, and takes its colour for the wheel", () => {
      const official = variant(true).official;
      expect(official).toMatchObject({
        discontinued: true,
        colorless: true,
        standIn: {
          name: "Moot Green",
          via: "replacement",
          publisher: "The Army Painter",
        },
        replacement: {
          paint: { name: "Moot Green" },
          sources: [{ publisher: "The Army Painter" }],
        },
      });
    });

    it("does not measure its rows against the wheel, nor pin it", () => {
      const results = variant(true);
      const rows = [
        ...(results.official?.outgoing ?? []),
        ...(results.official?.incoming ?? []),
      ];
      expect(rows.length).toBeGreaterThan(1);
      expect(rows.every(({ paint }) => paint.deltaE === null)).toBe(true);
      expect(results.official?.replacement?.paint.deltaE).toBeNull();
      expect(
        results.byBrand.flatMap((b) => b.paints).some((p) => p.chosen),
      ).toBe(false);
    });

    it("takes no colour with several equivalents and no replacement", () => {
      expect(variant(false).official).toMatchObject({
        colorless: true,
        standIn: null,
        replacement: null,
      });
    });
  });
});
