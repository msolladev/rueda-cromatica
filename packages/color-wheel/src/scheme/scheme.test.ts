import { describe, expect, it } from "vitest";

import { fromWheelColor, rotate, toWheelColor } from "../color/convert.ts";
import type { Model } from "../color/model.ts";
import type { WheelColor } from "../color/wheel-color.ts";
import { mixPaint } from "../mixing/mix.ts";
import { LIGHT_RATIO, LIGHTEN_RATIO, SHADOW_RATIO } from "../mixing/ratios.ts";
import { lightHex, neighborHex, shadowHex, type Light } from "./light.ts";
import { miniatureSchemeColors } from "./miniature-scheme.ts";

/** A wheel color with hue `hue` and half pure, half black. */
function dark(hue: number): WheelColor {
  return { hue, pure: 0.5, white: 0, black: 0.5 };
}

/** The expected neighbor's hex: hue `hue` with the proportions of `base`. */
function at(base: WheelColor, hue: number, model: Model): string {
  return fromWheelColor({ ...base, hue }, model);
}

describe("miniature scheme", () => {
  const base = dark(180);

  it("gives base, shadow, light, both triad colors and complement", () => {
    const colors = miniatureSchemeColors(base, "ryb", "warm");
    expect(colors.map(({ role }) => role)).toEqual([
      "base",
      "shadow",
      "light",
      "triad",
      "triad",
      "complement",
    ]);
    expect(colors.map(({ hex }) => hex)).toEqual([
      fromWheelColor(base, "ryb"),
      shadowHex(base, "ryb"),
      lightHex(base, "ryb", "warm"),
      at(base, 300, "ryb"),
      at(base, 60, "ryb"),
      at(base, 0, "ryb"),
    ]);
  });

  it("places the shadow and the light from their hex, with the base hue if grey", () => {
    const grey: WheelColor = { hue: 200, pure: 0, white: 0.5, black: 0.5 };
    for (const { role, hex, position } of miniatureSchemeColors(
      grey,
      "digital",
      "cold",
    )) {
      if (role === "shadow" || role === "light") {
        expect(position).toEqual(toWheelColor(hex, "digital", 200));
      }
    }
  });
});

describe("shadow", () => {
  it("mixes the base with its complement", () => {
    const base = dark(180);
    expect(shadowHex(base, "ryb")).toBe(
      mixPaint(
        fromWheelColor(base, "ryb"),
        fromWheelColor(rotate(base, 180), "ryb"),
        SHADOW_RATIO,
      ),
    );
  });
});

describe("light", () => {
  it("mixes the base with its neighbor lightened with white", () => {
    const base = dark(180);
    const lightened = mixPaint(
      neighborHex(base, "ryb", "warm"),
      "#ffffff",
      LIGHTEN_RATIO,
    );
    expect(lightHex(base, "ryb", "warm")).toBe(
      mixPaint(fromWheelColor(base, "ryb"), lightened, LIGHT_RATIO),
    );
  });

  // [model, light, base hue, neighbor hue]
  it.each<[Model, Light, number, number]>([
    // 30° towards the destination, along the shortest path.
    ["ryb", "warm", 180, 150],
    ["ryb", "warm", 0, 30],
    ["ryb", "cold", 0, 330],
    ["ryb", "cold", 180, 210],
    ["digital", "warm", 120, 90],
    ["digital", "warm", 0, 30],
    ["digital", "cold", 0, 330],
    // Without overshooting: under 30° and over 15° away, the destination itself.
    ["ryb", "warm", 140, 120],
    ["ryb", "warm", 100, 120],
    ["digital", "cold", 220, 240],
    // Tie: a base opposite the destination goes towards increasing angles.
    ["digital", "warm", 240, 270],
    ["digital", "cold", 60, 90],
    ["ryb", "warm", 300, 330],
    ["ryb", "cold", 60, 90],
  ])(
    "%s, %s light: the neighbor of %s° is at %s°",
    (model, light, hue, expected) => {
      const base = dark(hue);
      expect(neighborHex(base, model, light)).toBe(at(base, expected, model));
    },
  );

  describe("near the destination (15° or less)", () => {
    it.each<[Model, number]>([
      ["ryb", 120],
      ["ryb", 105],
      ["ryb", 135],
      ["digital", 60],
      ["digital", 75],
    ])("warm, %s model, base at %s°: the pure yellow", (model, hue) => {
      expect(neighborHex(dark(hue), model, "warm")).toBe("#ffff00");
    });

    it.each<[Model, number]>([
      ["ryb", 240],
      ["ryb", 225],
      ["digital", 255],
    ])("cold, %s model, base at %s°: white", (model, hue) => {
      expect(neighborHex(dark(hue), model, "cold")).toBe("#ffffff");
    });

    it("leaves the 15° boundary to the normal rule just outside it", () => {
      const base = dark(136);
      expect(neighborHex(base, "ryb", "warm")).toBe(at(base, 120, "ryb"));
    });
  });

  it("makes the light lighter than the base", () => {
    const base = dark(180);
    const sum = (hex: string) =>
      [1, 3, 5].reduce(
        (total, i) => total + Number.parseInt(hex.slice(i, i + 2), 16),
        0,
      );
    expect(sum(lightHex(base, "ryb", "warm"))).toBeGreaterThan(
      sum(fromWheelColor(base, "ryb")),
    );
  });
});
