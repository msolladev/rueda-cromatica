import { describe, expect, it } from "vitest";

import { fromWheelColor, toWheelColor } from "../color/convert.ts";
import { compute, type ComputeInput } from "./compute.ts";

describe("compute", () => {
  it("uses the default model, harmony and light", () => {
    expect(compute({ color: "#3daf44" })).toEqual(
      compute({
        color: "#3daf44",
        model: "ryb",
        harmony: "miniature-scheme",
        light: "warm",
      }),
    );
  });

  it("returns the result of docs/05 §6.7 for the miniature scheme", () => {
    const result = compute({ color: "#3daf44", light: "cold" });
    expect(result).toMatchObject({
      harmony: "miniature-scheme",
      model: "ryb",
      light: "cold",
    });
    expect(result.colors.map(({ role }) => role)).toEqual([
      "base",
      "shadow",
      "light",
      "triad",
      "triad",
      "complement",
    ]);
    for (const color of result.colors) {
      expect(Object.keys(color)).toEqual(["role", "hex"]);
      expect(color.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("leaves the light out of other harmonies", () => {
    const result = compute({
      color: "#3daf44",
      harmony: "triad",
      light: "cold",
    });
    expect(result).not.toHaveProperty("light");
  });

  it("returns the base in digital as it was received", () => {
    const result = compute({
      color: "#3DAF44",
      model: "digital",
      harmony: "triad",
    });
    expect(result.colors[0]).toEqual({ role: "base", hex: "#3daf44" });
  });

  it("returns as base the color that the RYB triangle reaches", () => {
    const result = compute({ color: "#00ffff", harmony: "complementary" });
    expect(result.colors[0]?.hex).toBe(
      fromWheelColor(toWheelColor("#00ffff", "ryb"), "ryb"),
    );
  });

  describe("invalid values", () => {
    it.each<[unknown, RegExp]>([
      [null, /Expected an object/],
      [{}, /Expected a hex color string, received undefined/],
      [{ color: "#xyz" }, /Invalid hex color "#xyz"/],
      [{ color: "#3daf44", model: "rgb" }, /Unknown model "rgb"/],
      [{ color: "#3daf44", harmony: "triadd" }, /Unknown harmony "triadd"/],
      // The light is validated even if the harmony does not use it.
      [
        { color: "#3daf44", harmony: "triad", light: "hot" },
        /Unknown light "hot"/,
      ],
      [{ color: "#3daf44", harmoy: "triad" }, /Unknown option "harmoy"/],
    ])("rejects %j", (input, message) => {
      expect(() => compute(input as ComputeInput)).toThrow(message);
    });
  });
});
