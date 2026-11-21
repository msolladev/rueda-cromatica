import { describe, expect, it } from "vitest";
import { gradientMidpoint } from "./color.ts";

describe("gradientMidpoint (ADR-0014)", () => {
  it("averages in CIELAB, not in RGB", () => {
    // L* 0 and 100 average to 50, which is #777777; RGB would give #808080.
    expect(gradientMidpoint("#000000", "#ffffff")).toBe("#777777");
  });

  it("returns the colour itself for a flat gradient", () => {
    expect(gradientMidpoint("#2d190c", "#2D190C")).toBe("#2d190c");
  });

  it("does not depend on the direction of the gradient", () => {
    expect(gradientMidpoint("#2d190c", "#e2dac8")).toBe(
      gradientMidpoint("#e2dac8", "#2d190c"),
    );
  });
});
