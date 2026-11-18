import { describe, expect, it } from "vitest";
import { brandId, find } from "../catalog/fixtures.ts";
import type { PaintType } from "../catalog/schema.ts";
import {
  compareMatches,
  DEFAULT_LIMIT,
  findClosestPaints,
  rankOverall,
  type ClosestPaints,
  type MatchOptions,
} from "./closest-paints.ts";
import { indexOf, realDraft } from "./fixtures.ts";

// Real colours of the catalog: Moot Green is #3daf44 and Light Stone (AK) is
// #cfa344. The expected paints and ΔE values come from `catalog.json`.
const MOOT_GREEN = "#3daf44";
const LIGHT_STONE = "#cfa344";
const WHITE = "#ffffff";

const ALL_TYPES: readonly PaintType[] = [
  "base",
  "layer",
  "standard",
  "wash",
  "ink",
  "glaze",
  "contrast",
  "technical",
  "dry",
];

const realIndex = indexOf(realDraft());

function search(hex: string, options: MatchOptions): ClosestPaints {
  const result = findClosestPaints(realIndex, hex, options);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const idsOf = (closest: ClosestPaints, brand: string): string[] =>
  find(
    closest.byBrand.map((group) => ({ ...group, id: group.brand.id })),
    brand,
  ).matches.map((match) => match.paint.id);

describe("findClosestPaints", () => {
  it("finds a paint by its own colour, at ΔE 0", () => {
    const closest = search(MOOT_GREEN, { brandIds: [brandId("citadel")] });
    const [first] = closest.byBrand[0]?.matches ?? [];
    expect(first?.paint.id).toBe("citadel/layer/moot-green");
    expect(first?.deltaE2000).toBe(0);
    expect(first?.quality).toBe("near-identical");
  });

  it("returns `limit` paints per brand, 3 by default", () => {
    const closest = search(MOOT_GREEN, { brandIds: "all" });
    expect(closest.limit).toBe(DEFAULT_LIMIT);
    for (const group of closest.byBrand) {
      expect(group.matches).toHaveLength(DEFAULT_LIMIT);
    }
    const one = search(MOOT_GREEN, { brandIds: "all", limit: 1 });
    expect(one.byBrand.map((group) => group.matches.length)).toEqual([
      1, 1, 1, 1,
    ]);
  });

  it("orders each brand by ΔE", () => {
    const closest = search(MOOT_GREEN, { brandIds: "all", limit: 10 });
    for (const { matches } of closest.byBrand) {
      const deltas = matches.map((match) => match.deltaE2000);
      expect(deltas).toEqual([...deltas].sort((a, b) => a - b));
    }
  });

  describe("brand filter", () => {
    it("searches every brand, in catalog order, with 'all'", () => {
      const closest = search(MOOT_GREEN, { brandIds: "all" });
      expect(closest.byBrand.map((group) => group.brand.id)).toEqual([
        "ak-interactive",
        "citadel",
        "the-army-painter",
        "vallejo",
      ]);
    });

    it("searches only the selected brands, in catalog order", () => {
      const closest = search(MOOT_GREEN, {
        brandIds: [brandId("vallejo"), brandId("citadel")],
      });
      expect(closest.byBrand.map((group) => group.brand.id)).toEqual([
        "citadel",
        "vallejo",
      ]);
      for (const { brand, matches } of closest.byBrand) {
        for (const match of matches) expect(match.brand).toBe(brand);
      }
    });

    it("returns no brands for an empty selection", () => {
      expect(search(MOOT_GREEN, { brandIds: [] }).byBrand).toEqual([]);
    });
  });

  describe("candidate filter", () => {
    it("offers only opaque, non-metallic paints by default", () => {
      // Tesseract Glow (technical, ΔE 2.71) and Hexwraith Flame (contrast,
      // 4.80) are closer than Sybarite Green (layer, 9.69).
      expect(
        idsOf(
          search(MOOT_GREEN, { brandIds: [brandId("citadel")] }),
          "citadel",
        ),
      ).toEqual([
        "citadel/layer/moot-green",
        "citadel/layer/sybarite-green",
        "citadel/base/orruk-flesh",
      ]);
    });

    it("offers the chosen paint types", () => {
      expect(
        idsOf(
          search(MOOT_GREEN, {
            brandIds: [brandId("citadel")],
            paintTypes: ALL_TYPES,
          }),
          "citadel",
        ),
      ).toEqual([
        "citadel/layer/moot-green",
        "citadel/technical/tesseract-glow",
        "citadel/contrast/hexwraith-flame",
      ]);
    });

    it("offers metallic paints only when asked", () => {
      const ak = { brandIds: [brandId("ak-interactive")], limit: 4 };
      // Metallic Green (ΔE 10.86) is the fourth closest standard paint.
      expect(idsOf(search(MOOT_GREEN, ak), "ak-interactive")).not.toContain(
        "ak-interactive/3gen-acrylics/metallic-green",
      );
      expect(
        idsOf(
          search(MOOT_GREEN, { ...ak, includeMetallic: true }),
          "ak-interactive",
        ),
      ).toContain("ak-interactive/3gen-acrylics/metallic-green");
    });

    it("keeps a brand without candidates, with no matches", () => {
      const closest = search(MOOT_GREEN, {
        brandIds: [brandId("citadel")],
        paintTypes: ["glaze"],
      });
      expect(closest.byBrand).toHaveLength(1);
      expect(closest.byBrand[0]?.matches).toEqual([]);
    });
  });

  it("never offers a paint without colour", () => {
    const draft = realDraft();
    find(draft.paints, "citadel/layer/moot-green").color = null;
    const result = findClosestPaints(indexOf(draft), MOOT_GREEN, {
      brandIds: [brandId("citadel")],
    });
    expect(result.ok && result.value.byBrand[0]?.matches[0]?.paint.id).toBe(
      "citadel/layer/sybarite-green",
    );
  });

  describe("approximate colour", () => {
    it("flags every paint of today's catalog: all its hex are community", () => {
      const closest = search(MOOT_GREEN, { brandIds: "all" });
      for (const { matches } of closest.byBrand) {
        for (const match of matches) expect(match.approximate).toBe(true);
      }
    });

    it("does not flag an opaque paint with a manufacturer hex", () => {
      const draft = realDraft();
      const color = find(draft.paints, "citadel/layer/moot-green").color;
      if (color === null) throw new Error("Moot Green has a colour");
      color.origin = "manufacturer";
      const result = findClosestPaints(indexOf(draft), MOOT_GREEN, {
        brandIds: [brandId("citadel")],
      });
      if (!result.ok) throw new Error("Expected a result");
      expect(
        result.value.byBrand[0]?.matches.map((match) => match.approximate),
      ).toEqual([false, true, true]);
    });

    it("does not reorder approximate paints", () => {
      const closest = search(MOOT_GREEN, {
        brandIds: [brandId("citadel")],
        paintTypes: ALL_TYPES,
      });
      expect(closest.byBrand[0]?.matches[0]?.paint.id).toBe(
        "citadel/layer/moot-green",
      );
    });
  });

  describe("deterministic order", () => {
    it("breaks exact ties by paint ID", () => {
      // Six AK paints share #ffffff, the four technical ones among them.
      expect(
        idsOf(
          search(WHITE, {
            brandIds: [brandId("ak-interactive")],
            paintTypes: ALL_TYPES,
            limit: 6,
          }),
          "ak-interactive",
        ),
      ).toEqual([
        "ak-interactive/3gen-acrylics/blood-effect",
        "ak-interactive/3gen-acrylics/chipping-effect",
        "ak-interactive/3gen-acrylics/frost-effect",
        "ak-interactive/3gen-acrylics/viscera-effect",
        "ak-interactive/3gen-acrylics/washable-white-paint",
        "ak-interactive/3gen-acrylics/white",
      ]);
    });

    it("compares ΔE at 2 decimals, so near ties also go by ID", () => {
      // Zamesi Desert is at 4.5760 and Ungor Flesh at 4.5801: both 4.58.
      const [first, second] =
        search(LIGHT_STONE, { brandIds: [brandId("citadel")] }).byBrand[0]
          ?.matches ?? [];
      expect(first?.paint.id).toBe("citadel/layer/ungor-flesh");
      expect(second?.paint.id).toBe("citadel/layer/zamesi-desert");
      expect(first?.deltaE2000).toBeGreaterThan(second?.deltaE2000 ?? 0);
    });

    it("gives the same result for the same input", () => {
      const options = { brandIds: "all", limit: 10 } as const;
      expect(search(LIGHT_STONE, options)).toEqual(
        search(LIGHT_STONE, options),
      );
    });
  });

  it("accepts the hex in any case", () => {
    expect(search("#3DAF44", { brandIds: "all" })).toEqual(
      search(MOOT_GREEN, { brandIds: "all" }),
    );
  });

  describe("errors", () => {
    it.each(["3daf44", "#3af", "#3daf4", "#3daf44ff", "green", ""])(
      "rejects the colour %j",
      (color) => {
        expect(
          findClosestPaints(realIndex, color, { brandIds: "all" }),
        ).toEqual({ ok: false, error: { kind: "invalid-color", color } });
      },
    );

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      "rejects the limit %d",
      (limit) => {
        expect(
          findClosestPaints(realIndex, MOOT_GREEN, { brandIds: "all", limit }),
        ).toEqual({ ok: false, error: { kind: "invalid-limit", limit } });
      },
    );
  });
});

describe("rankOverall", () => {
  it("ranks every brand's matches together, up to `limit`", () => {
    // Moot Green (Citadel, 0) and, with 7.44 and 7.55, Ferocious Green (Army
    // Painter) and Clear Green (AK).
    const ranked = rankOverall(search(MOOT_GREEN, { brandIds: "all" }));
    expect(ranked.map((match) => match.paint.id)).toEqual([
      "citadel/layer/moot-green",
      "the-army-painter/warpaints-fanatic/ferocious-green",
      "ak-interactive/3gen-acrylics/clear-green",
    ]);
  });

  it("returns at most `limit`, the positions it can rank exactly", () => {
    const closest = search(MOOT_GREEN, { brandIds: "all", limit: 5 });
    const ranked = rankOverall(closest);
    expect(ranked).toHaveLength(5);
    expect([...ranked]).toEqual([...ranked].sort(compareMatches));
  });

  it("returns fewer when the brands have fewer matches", () => {
    const closest = search(MOOT_GREEN, {
      brandIds: [brandId("citadel")],
      paintTypes: ["glaze"],
    });
    expect(rankOverall(closest)).toEqual([]);
  });
});
