import { describe, expect, it } from "vitest";
import {
  catalogOf,
  draftPaint,
  insertSorted,
  paintId,
  validDraft,
  type DraftPaint,
} from "./fixtures.ts";
import {
  colorApproximationReasons,
  isColorApproximate,
  resolveReplacement,
} from "./rules.ts";
import { paintSchema, paintTypeSchema } from "./schema.ts";

describe("isColorApproximate", () => {
  const paint = (overrides: Partial<DraftPaint>) =>
    paintSchema.parse(
      draftPaint({
        id: "acme/core/p",
        rangeId: "acme/core",
        color: {
          hex: "#112233",
          origin: "manufacturer",
          sourceId: "acme-conversion-chart",
        },
        ...overrides,
      }),
    );

  it("is false for an opaque, non-metallic manufacturer colour", () => {
    expect(isColorApproximate(paint({ type: "base" }))).toBe(false);
  });

  it("is false for a paint without colour", () => {
    expect(
      isColorApproximate(paint({ color: null, metallic: true, type: "wash" })),
    ).toBe(false);
  });

  it("is true for a metallic paint", () => {
    expect(isColorApproximate(paint({ metallic: true }))).toBe(true);
  });

  it("is true for a community colour", () => {
    const community = paint({
      color: { hex: "#112233", origin: "community", sourceId: "s" },
    });
    expect(isColorApproximate(community)).toBe(true);
  });

  it("is false for a measured opaque colour", () => {
    const measured = paint({
      color: { hex: "#112233", origin: "measured", sourceId: "s" },
    });
    expect(isColorApproximate(measured)).toBe(false);
  });

  const approximateTypes = ["wash", "ink", "glaze", "contrast", "technical"];
  it.each(paintTypeSchema.options)("type %s", (type) => {
    expect(isColorApproximate(paint({ type }))).toBe(
      approximateTypes.includes(type),
    );
  });
});

describe("colorApproximationReasons", () => {
  const paint = (overrides: Partial<DraftPaint>) =>
    paintSchema.parse(
      draftPaint({
        id: "acme/core/p",
        rangeId: "acme/core",
        color: {
          hex: "#112233",
          origin: "manufacturer",
          sourceId: "acme-conversion-chart",
        },
        ...overrides,
      }),
    );

  it("is empty for an exact colour and for a paint without colour", () => {
    expect(colorApproximationReasons(paint({ type: "layer" }))).toEqual([]);
    expect(
      colorApproximationReasons(
        paint({ color: null, metallic: true, type: "wash" }),
      ),
    ).toEqual([]);
  });

  it("gives every reason, in a fixed order", () => {
    const all = paint({
      type: "wash",
      metallic: true,
      color: { hex: "#112233", origin: "community", sourceId: "s" },
    });
    expect(colorApproximationReasons(all)).toEqual([
      "metallic",
      "paint-type",
      "community-color",
    ]);
  });

  it("agrees with isColorApproximate", () => {
    for (const type of paintTypeSchema.options) {
      const p = paint({ type });
      expect(colorApproximationReasons(p).length > 0).toBe(
        isColorApproximate(p),
      );
    }
  });

  it("is frozen", () => {
    expect(Object.isFrozen(colorApproximationReasons(paint({})))).toBe(true);
  });
});

describe("resolveReplacement", () => {
  const replacedBy = (id: string) =>
    ({
      kind: "discontinued",
      replacement: { paintId: id, sourceId: "acme-conversion-chart" },
    }) as const;

  const draft = validDraft();
  insertSorted(
    draft.paints,
    draftPaint({
      id: "acme/classic/first",
      rangeId: "acme/classic",
      status: replacedBy("acme/classic/old-red"),
    }),
    draftPaint({
      id: "acme/classic/to-dead-end",
      rangeId: "acme/classic",
      status: replacedBy("acme/classic/dead-end"),
    }),
    draftPaint({
      id: "acme/classic/dead-end",
      rangeId: "acme/classic",
      status: { kind: "discontinued", replacement: null },
    }),
  );
  const catalog = catalogOf(draft);
  const resolve = (id: string) =>
    resolveReplacement(catalog, paintId(id))?.id ?? null;

  it("returns null for an active paint", () => {
    expect(resolve("acme/core/deep-red")).toBeNull();
  });

  it("returns null for a discontinued paint without replacement", () => {
    expect(resolve("acme/classic/dead-end")).toBeNull();
  });

  it("follows a single replacement", () => {
    expect(resolve("acme/classic/old-red")).toBe("acme/core/deep-red");
  });

  it("follows the chain up to an active paint", () => {
    expect(resolve("acme/classic/first")).toBe("acme/core/deep-red");
  });

  it("stops at the end of the chain if it never reaches an active paint", () => {
    expect(resolve("acme/classic/to-dead-end")).toBe("acme/classic/dead-end");
  });

  it("throws for an unknown ID", () => {
    expect(() => resolve("acme/core/missing")).toThrow();
  });
});
