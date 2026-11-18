import { describe, expect, it } from "vitest";
import { matchQuality } from "./quality.ts";

describe("matchQuality", () => {
  it.each([
    [0, "near-identical"],
    [1, "near-identical"],
    [1.004, "near-identical"], // rounds to 1.00
    [1.006, "very-similar"], // rounds to 1.01
    [2, "very-similar"],
    [2.01, "similar"],
    [5, "similar"],
    [5.01, "nearest-available"],
    [42, "nearest-available"],
  ] as const)("labels ΔE %d as %s", (deltaE, quality) => {
    expect(matchQuality(deltaE)).toBe(quality);
  });
});
