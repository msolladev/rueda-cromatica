import { describe, expect, it } from "vitest";

import { mixPaint } from "./mix.ts";

describe("mixPaint", () => {
  it("mixes like pigments: yellow and blue give green", () => {
    const green = mixPaint("#ffff00", "#0000ff", 0.5);
    const [r, g, b] = [1, 3, 5].map((i) =>
      Number.parseInt(green.slice(i, i + 2), 16),
    );
    expect(g).toBeGreaterThan(r ?? 0);
    expect(g).toBeGreaterThan(b ?? 0);
  });

  it("returns lowercase #rrggbb", () => {
    expect(mixPaint("#FF0000", "#ffffff", 0.5)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("returns the base with ratio 0 and the other color with ratio 1", () => {
    expect(mixPaint("#3daf44", "#ffffff", 0)).toBe("#3daf44");
    expect(mixPaint("#3daf44", "#c01411", 1)).toBe("#c01411");
  });

  it.each([-0.1, 1.1, Number.NaN])("rejects the ratio %s", (ratio) => {
    expect(() => mixPaint("#ff0000", "#ffffff", ratio)).toThrow(RangeError);
  });
});
