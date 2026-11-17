import { describe, expect, it } from "vitest";

import { fromWheelColor } from "../color/convert.ts";
import { MODELS } from "../color/model.ts";
import { parseHexColor } from "../color/rgb.ts";
import type { WheelColor } from "../color/wheel-color.ts";
import { mixPaint } from "../mixing/mix.ts";
import { VARIATION_RATIO } from "../mixing/ratios.ts";
import { assertHarmony } from "./harmony.ts";
import { monochromaticColors } from "./monochromatic.ts";
import { rotationColors, type RotationHarmony } from "./rotations.ts";

/** A brown: the orange hue with plenty of black (docs/05 §2). */
const BROWN: WheelColor = { hue: 30, pure: 0.45, white: 0.1, black: 0.45 };

const EXPECTED: Record<RotationHarmony, [string, number][]> = {
  complementary: [
    ["base", 0],
    ["complement", 180],
  ],
  "split-complementary": [
    ["base", 0],
    ["split", 150],
    ["split", 210],
  ],
  analogous: [
    ["base", 0],
    ["analogous", -30],
    ["analogous", 30],
  ],
  "accented-analogous": [
    ["base", 0],
    ["analogous", -30],
    ["analogous", 30],
    ["accent", 180],
  ],
  triad: [
    ["base", 0],
    ["triad", 120],
    ["triad", 240],
  ],
  square: [
    ["base", 0],
    ["complement", 180],
    ["square", 90],
    ["square", 270],
  ],
  rectangle: [
    ["base", 0],
    ["complement", 180],
    ["tetrad", 60],
    ["tetrad", 240],
  ],
};

describe.each(MODELS)("rotations in the %s model", (model) => {
  it.each(Object.entries(EXPECTED))(
    "%s gives its roles, order and angles",
    (harmony, expected) => {
      const colors = rotationColors(BROWN, model, harmony as RotationHarmony);
      expect(colors.map(({ role }) => role)).toEqual(
        expected.map(([role]) => role),
      );
      colors.forEach(({ hex, position }, i) => {
        const degrees = expected[i]?.[1] ?? Number.NaN;
        expect(position).toEqual({
          ...BROWN,
          hue: (((BROWN.hue + degrees) % 360) + 360) % 360,
        });
        expect(hex).toBe(fromWheelColor(position, model));
      });
    },
  );
});

describe("the same harmony in each model", () => {
  const red: WheelColor = { hue: 0, pure: 1, white: 0, black: 0 };

  it("gives green as the complement of red in RYB", () => {
    expect(rotationColors(red, "ryb", "complementary")[1]?.hex).toBe("#00a833");
  });

  it("gives cyan as the complement of red in digital", () => {
    expect(rotationColors(red, "digital", "complementary")[1]?.hex).toBe(
      "#00ffff",
    );
  });
});

describe("monochromatic", () => {
  it("mixes the base with white, grey and black, in that order", () => {
    const base = fromWheelColor(BROWN, "ryb");
    const colors = monochromaticColors(BROWN, "ryb");
    expect(colors.map(({ role, hex }) => [role, hex])).toEqual([
      ["base", base],
      ["tint", mixPaint(base, "#ffffff", VARIATION_RATIO)],
      ["tone", mixPaint(base, "#808080", VARIATION_RATIO)],
      ["shade", mixPaint(base, "#000000", VARIATION_RATIO)],
    ]);
  });

  it("goes from lighter to darker", () => {
    const [base, tint, , shade] = monochromaticColors(BROWN, "digital").map(
      ({ hex }) => luminance(hex),
    );
    expect(tint).toBeGreaterThan(base ?? 0);
    expect(shade).toBeLessThan(base ?? 0);
  });

  it("places each variation on the wheel from its hex", () => {
    for (const { hex, position } of monochromaticColors(BROWN, "digital")) {
      expect(fromWheelColor(position, "digital")).toBe(hex);
    }
  });
});

describe("assertHarmony", () => {
  it("rejects an unknown harmony and lists the valid ones", () => {
    expect(() => {
      assertHarmony("triadd");
    }).toThrow(/Unknown harmony "triadd". Expected one of "complementary"/);
  });
});

function luminance(hex: string): number {
  const { r, g, b } = parseHexColor(hex);
  return r + g + b;
}
