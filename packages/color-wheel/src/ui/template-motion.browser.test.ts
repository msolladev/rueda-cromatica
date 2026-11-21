import { describe, expect, it } from "vitest";
import {
  easeOut,
  interpolatePosition,
  interpolateTemplate,
  sameTemplate,
  turnTemplate,
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

describe("interpolatePosition", () => {
  const from = { hue: 350, pure: 1, white: 0, black: 0 };
  const to = { hue: 30, pure: 0.2, white: 0.4, black: 0.4 };

  it("starts and ends on each base", () => {
    expect(interpolatePosition(from, to, 0)).toEqual(from);
    expect(interpolatePosition(from, to, 1)).toEqual(to);
  });

  it("turns along the shortest arc and keeps the proportions adding up to 1", () => {
    const half = interpolatePosition(from, to, 0.5);
    expect(half.hue).toBeCloseTo(10);
    expect(half.pure).toBeCloseTo(0.6);
    expect(half.white).toBeCloseTo(0.2);
    expect(half.pure + half.white + half.black).toBeCloseTo(1);
  });
});

describe("turnTemplate", () => {
  it("turns the whole template with the base", () => {
    // A triad that moves from 0° to 90° turns rigidly.
    const halfway = turnTemplate([0, 120, 240], [90, 210, 330], 45, 0.5);
    expect(halfway.map((hue) => Math.round(hue))).toEqual([45, 165, 285]);
  });

  it("is interpolateTemplate with the base still", () => {
    expect(turnTemplate([10, 130, 250], [10, 190], 10, 0.5)).toEqual(
      interpolateTemplate([10, 130, 250], [10, 190], 0.5),
    );
  });
});
