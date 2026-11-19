import { describe, expect, it } from "vitest";
import { colorNames, labelsFor } from "./labels.ts";
import { placeMarkLabels, type MarkLabel } from "./mark-labels.ts";

const box = (hue: number): MarkLabel => ({ hue, width: 60, height: 16 });

/** Whether two boxes of the same size, centered on `a` and `b`, touch. */
const touch = (
  a: { x: number; y: number },
  b: { x: number; y: number },
  label: MarkLabel,
) => Math.abs(a.x - b.x) < label.width && Math.abs(a.y - b.y) < label.height;

describe("placeMarkLabels", () => {
  it("puts a lone name on the line of its mark, inside the limit", () => {
    const [top] = placeMarkLabels([box(0)], 100);
    expect(top?.x).toBeCloseTo(0);
    // Its upper edge touches the limit.
    expect(top?.y).toBeCloseTo(-100 + 8);
    const [right] = placeMarkLabels([box(90)], 100);
    expect(right?.x).toBeCloseTo(100 - 30);
    expect(right?.y).toBeCloseTo(0);
  });

  it("leaves far names where they are", () => {
    const centers = placeMarkLabels([box(0), box(120), box(240)], 100);
    const alone = [0, 120, 240].map((hue) => placeMarkLabels([box(hue)], 100));
    centers.forEach((center, index) => {
      expect(center).toEqual(alone[index]?.[0]);
    });
  });

  it("stacks close names, in the order of the colors, without overlaps", () => {
    const labels = [box(10), box(4), box(16), box(130)];
    const centers = placeMarkLabels(labels, 100);
    for (let i = 0; i < centers.length; i += 1) {
      for (let j = i + 1; j < centers.length; j += 1) {
        const a = centers[i];
        const b = centers[j];
        if (a === undefined || b === undefined) throw new Error("Missing");
        expect(touch(a, b, box(0))).toBe(false);
      }
    }
    const [base, shadow, light] = centers;
    expect(base?.x).toBeCloseTo(shadow?.x ?? NaN);
    expect(base?.y).toBeLessThan(shadow?.y ?? NaN);
    expect(shadow?.y).toBeLessThan(light?.y ?? NaN);
  });

  it("stacks every name of marks on the same hue", () => {
    const centers = placeMarkLabels([box(200), box(200), box(200)], 100);
    const ys = centers.map((center) => center.y);
    expect(new Set(ys).size).toBe(3);
  });
});

describe("colorNames", () => {
  it("numbers only the roles that repeat", () => {
    const labels = labelsFor("es");
    expect(
      colorNames(
        [
          { role: "base" },
          { role: "shadow" },
          { role: "light" },
          { role: "triad" },
          { role: "triad" },
          { role: "complement" },
        ],
        labels,
      ),
    ).toEqual([
      "Base",
      labels.role.shadow,
      labels.role.light,
      `${labels.role.triad} 1`,
      `${labels.role.triad} 2`,
      labels.role.complement,
    ]);
  });
});
