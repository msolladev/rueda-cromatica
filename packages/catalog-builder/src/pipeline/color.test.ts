import { sourceIdSchema } from "@chromatic-wheel/domain";
import { describe, expect, it } from "vitest";
import {
  readSourceFile,
  sourceRowSchema,
  type ColorPolicy,
} from "../curated/files.ts";
import { acmeSource, row, valid, type Row } from "../fixtures.ts";
import { checkColorPolicy, gradientMidpoint, paintColor } from "./color.ts";

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

describe("paintColor (ADR-0014)", () => {
  const sourceId = sourceIdSchema.parse("acme-chart");
  const policy = (patch: Partial<ColorPolicy> = {}): ColorPolicy => ({
    measured: [],
    manufacturer: [],
    community: [sourceId],
    ...patch,
  });
  const rows = (patch: Partial<Row>) => [
    { sourceId, row: sourceRowSchema.parse(row({ key: "AC-01", ...patch })) },
  ];
  const colorOf = (patch: Partial<Row>, p = policy()) => {
    const result = paintColor(rows(patch), p);
    if (!result.ok) throw new Error(result.error);
    return result.value;
  };

  it("normalises the hex and takes the origin of the source's list", () => {
    expect(colorOf({ hex: "#AA0000" })).toEqual({
      hex: "#aa0000",
      origin: "community",
      sourceId,
    });
    expect(
      colorOf(
        { hex: "#AA0000" },
        policy({ manufacturer: [sourceId], community: [] }),
      )?.origin,
    ).toBe("manufacturer");
  });

  it("reduces a gradient to its midpoint", () => {
    expect(
      colorOf({ hex: null, gradient: { dark: "#000000", light: "#FFFFFF" } })
        ?.hex,
    ).toBe("#777777");
  });

  it("is null when no row gives a colour", () => {
    expect(colorOf({ hex: null })).toBeNull();
    expect(paintColor([], policy())).toEqual({ ok: true, value: null });
  });

  it("ignores a measured hex unless the source is in the measured list", () => {
    expect(colorOf({ measuredHex: "#111111" })?.origin).toBe("community");
    expect(
      colorOf(
        { hex: null, measuredHex: "#111111" },
        policy({ measured: [sourceId] }),
      ),
    ).toEqual({ hex: "#111111", origin: "measured", sourceId });
  });

  it("fails on several candidates, until they can be chosen (step 2)", () => {
    const result = paintColor(
      rows({ measuredHex: "#111111" }),
      policy({ measured: [sourceId] }),
    );
    expect(result.ok).toBe(false);
  });
});

describe("checkColorPolicy", () => {
  const source = (hex: string | null) =>
    valid(
      readSourceFile({
        ...acmeSource(),
        content: {
          ...acmeSource().content,
          paints: [row({ key: "AC-01", hex })],
        },
      }),
    );

  it("requires a source that gives colours to be in a hex list", () => {
    const empty = { measured: [], manufacturer: [], community: [] };
    expect(checkColorPolicy(empty, [source("#000000")])).toEqual([
      "acme-chart gives colours but is neither in manufacturer nor in community",
    ]);
    expect(checkColorPolicy(empty, [source(null)])).toEqual([]);
  });

  it("rejects an unknown source", () => {
    const policy = {
      measured: [sourceIdSchema.parse("initech-lab")],
      manufacturer: [sourceIdSchema.parse("acme-chart")],
      community: [],
    };
    expect(checkColorPolicy(policy, [source(null)])).toEqual([
      "measured[0]: unknown source initech-lab",
    ]);
  });
});
