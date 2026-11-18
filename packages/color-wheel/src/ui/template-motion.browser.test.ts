import { describe, expect, it } from "vitest";
import {
  easeOut,
  interpolateTemplate,
  sameTemplate,
} from "./template-motion.ts";

describe("interpolateTemplate", () => {
  it("starts and ends on each template", () => {
    expect(interpolateTemplate([10, 130, 250], [10, 190], 0)).toEqual([
      10, 130, 250,
    ]);
    expect(interpolateTemplate([10, 130, 250], [10, 190], 1)).toEqual([
      10, 190, 10,
    ]);
  });

  it("travels along the shortest arc", () => {
    expect(interpolateTemplate([0, 350], [0, 10], 0.5)).toEqual([0, 0]);
    expect(interpolateTemplate([0, 10], [0, 350], 0.5)).toEqual([0, 0]);
  });

  it("brings new marks out of the base", () => {
    expect(interpolateTemplate([30, 210], [30, 150, 270], 0)).toEqual([
      30, 210, 30,
    ]);
  });
});

describe("easeOut", () => {
  it("goes from 0 to 1, faster at first", () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
  });
});

describe("sameTemplate", () => {
  it("compares to the hundredth of a degree", () => {
    expect(sameTemplate([10, 190], [10.001, 190])).toBe(true);
    expect(sameTemplate([10, 190], [10, 191])).toBe(false);
    expect(sameTemplate([10], [10, 190])).toBe(false);
  });
});
