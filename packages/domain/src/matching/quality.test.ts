import { describe, expect, it } from "vitest";
import { matchQuality } from "./quality.ts";

describe("matchQuality", () => {
  it.each([
    [0, "identical"],
    [0.004, "identical"], // rounds to 0.00
    [0.006, "near-identical"], // rounds to 0.01
    [1, "near-identical"],
    [1.004, "near-identical"], // rounds to 1.00
    [1.006, "very-similar"], // rounds to 1.01
    [2, "very-similar"],
    [2.01, "similar"],
    [5, "similar"],
    [5.01, "barely-similar"],
    [15, "barely-similar"],
    [15.01, "different"],
    [42, "different"],
  ] as const)("labels ΔE %d as %s", (deltaE, quality) => {
    expect(matchQuality(deltaE)).toBe(quality);
  });
});
