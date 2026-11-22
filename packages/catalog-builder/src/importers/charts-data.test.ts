/**
 * The row counts of each chart, read from its curated transcription
 * (ADR-0033): what the chart shows when counted by hand. A new revision that
 * changes them makes this test fail, so its diff gets reviewed.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { brandFileSchema, sourceFileSchema } from "../curated/files.ts";

const read = (id: string) =>
  sourceFileSchema.parse(
    JSON.parse(
      readFileSync(
        join(import.meta.dirname, `../../data/sources/${id}.json`),
        "utf8",
      ),
    ),
  );

/** How many equivalences go from each group to each group. */
function counts(id: string): Record<string, number> {
  const file = read(id);
  const group = new Map(file.paints.map((p) => [p.key, p.group]));
  const result: Record<string, number> = {};
  for (const { from, to } of file.equivalences) {
    const pair = `${group.get(from) ?? "?"} → ${group.get(to) ?? "?"}`;
    result[pair] = (result[pair] ?? 0) + 1;
  }
  return result;
}

const rowsOf = (id: string, group: string): number =>
  read(id).paints.filter((p) => p.group === group).length;

describe("transcribed charts", () => {
  it("Vallejo CC266: 67 Game Color, 5 Wash and 37 Xpress Color rows", () => {
    expect(rowsOf("vallejo-cc266", "Game Color")).toBe(67);
    expect(rowsOf("vallejo-cc266", "Game Color Wash")).toBe(5);
    expect(rowsOf("vallejo-cc266", "Xpress Color")).toBe(37);
    expect(counts("vallejo-cc266")).toEqual({
      "Game Color → Game Air": 51,
      "Game Color → Hobby Paint": 17,
      "Game Color → Citadel": 52,
      "Game Color Wash → Citadel": 5,
      "Xpress Color → Citadel": 37,
    });
  });

  it("Warpaints Fanatic Conversion Chart: 197 colours", () => {
    const id = "the-army-painter-fanatic-conversion-chart";
    expect(rowsOf(id, "Warpaints Fanatic")).toBe(197);
    expect(counts(id)).toEqual({
      "Warpaints Fanatic → Original Warpaints": 118,
      "Warpaints Fanatic → Warpaints Air": 88,
      "Warpaints Fanatic → Citadel by Games Workshop": 129,
    });
  });

  describe("Warpaints conversion chart of 2020, transcribed by hand", () => {
    const id = "the-army-painter-warpaints-conversion-chart";
    const warpaints = read(id).paints.filter((p) => p.group === "Warpaints");

    it("has the 124 Warpaints of the complete set, each with its cells", () => {
      expect(warpaints).toHaveLength(124);
      expect(counts(id)).toEqual({
        "Warpaints → GM": 124,
        "Warpaints → AV": 95,
      });
    });

    // A second reading: each name is in the Warpaints Fanatic chart, which
    // has a text layer, or is one of those the 2020 chart alone has.
    it("names the Warpaints of the Fanatic chart, or the ones it alone has", () => {
      const fanatic = new Set(
        read("the-army-painter-fanatic-conversion-chart")
          .paints.filter((p) => p.group === "Original Warpaints")
          .map((p) => p.name.replaceAll("’", "'")),
      );
      const only2020 = warpaints
        .map((p) => p.name)
        .filter((name) => !fanatic.has(name));
      expect(only2020.sort()).toEqual([
        "Anti-Shine Matt Varnish",
        "Brush-On Primer",
        "Castle Grey",
        "Crypt Wraith",
        "Cultist Robe",
        "Dark Stone",
        "Disgusting Slime",
        "Dry Rust",
        "Dungeon Grey",
        "Elven Flesh",
        "Field Grey",
        "Filthy Cape",
        "Flesh Wash",
        "Glistening Blood",
        "Gloss Varnish",
        "Mouldy Clothes",
        "Quickshade Wash Mixing Medium",
        "Warpaints Mixing Medium",
        "Wet Mud",
      ]);
    });

    // The page of the complete set (WP8022P) counts «96 Acrylic Warpaints,
    // 8 Metallic Warpaints, 11 Quickshade Washes and 9 Effects Warpaints»;
    // five of the effects are auxiliary products, out of the catalog.
    it("classifies them as the complete set counts them", () => {
      const keys = new Set(warpaints.map((p) => p.key));
      const brand = brandFileSchema.parse(
        JSON.parse(
          readFileSync(
            join(
              import.meta.dirname,
              "../../data/brands/the-army-painter.json",
            ),
            "utf8",
          ),
        ),
      );
      const kinds: Record<string, number> = {};
      for (const paint of brand.paints) {
        if (!paint.keys.some((k) => k.sourceId === id && keys.has(k.key))) {
          continue;
        }
        const kind = paint.metallic ? "metallic" : paint.type;
        kinds[kind] = (kinds[kind] ?? 0) + 1;
      }
      const auxiliary = read(id).ignoredKeys.filter(
        (k) => keys.has(k.key) && k.reasonId === "auxiliary",
      );
      expect(kinds).toEqual({
        standard: 96,
        metallic: 8,
        wash: 11,
        technical: 4,
      });
      expect(auxiliary).toHaveLength(5);
    });
  });

  it("AK equivalence table: 356 references", () => {
    const id = "ak-interactive-3gen-equivalence-table";
    expect(rowsOf(id, "AK 3G")).toBe(356);
    expect(counts(id)).toEqual({
      "AK 3G → Vallejo MC": 219,
      "AK 3G → Vallejo GC": 51,
      "AK 3G → New Citadel": 50,
      "AK 3G → Old Citadel": 50,
    });
  });
});
