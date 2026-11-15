import { describe, expect, it } from "vitest";
import { importDonnervS, type DonnervSBrand } from "./donnervs.ts";

const brand: DonnervSBrand = {
  file: "paints/json/Acme.json",
  lines: {
    Core: { rangeId: "acme/core", type: "standard", metallic: false },
    Metals: { rangeId: "acme/core", type: "standard", metallic: true },
    Air: null,
  },
  excluded: (code) => code === "AC90",
  override: (code) =>
    code === "AC10"
      ? { metallic: true }
      : code === "AC20"
        ? { type: "technical" }
        : undefined,
  cleanName: (name) => name.replace(/^FIG /, ""),
  nameErrata: { AC30: "Bony White" },
  slugs: { AC40: "red-figures" },
  photoOverMeasured: new Set(["AC50"]),
};

const row = (patch: Record<string, unknown> = {}) => ({
  name: "Red",
  code: "AC01",
  set: "Core",
  hex: "#AA0000",
  colourless: false,
  measuredHex: null,
  ...patch,
});

function imported(rows: unknown[]) {
  const result = importDonnervS({ paints: rows }, brand, "donnervs");
  if (!result.ok) throw new Error(result.error.join("\n"));
  return result.value;
}

const issues = (rows: unknown[]) => {
  const result = importDonnervS({ paints: rows }, brand, "donnervs");
  return result.ok ? [] : result.error;
};

describe("importDonnervS", () => {
  it("reads a row into a paint of its range, with code and lowercase hex", () => {
    expect(imported([row()])).toEqual([
      {
        rangeId: "acme/core",
        name: "Red",
        manufacturerCode: "AC01",
        type: "standard",
        metallic: false,
        color: { hex: "#aa0000", origin: "community", sourceId: "donnervs" },
      },
    ]);
  });

  it("takes type and metallic from the line or, by code, from an override", () => {
    const paints = imported([
      row({ code: "AC02", set: "Metals" }),
      row({ code: "AC10" }),
      row({ code: "AC20" }),
    ]);
    expect(paints.map((p) => `${p.type} ${String(p.metallic)}`)).toEqual([
      "standard true",
      "standard true",
      "technical false",
    ]);
  });

  it("leaves out sets outside the MVP and excluded codes", () => {
    expect(imported([row({ set: "Air" }), row({ code: "AC90" })])).toEqual([]);
  });

  it("strips the prefix DonnervS adds and corrects misspelt names", () => {
    const paints = imported([
      row({ name: "FIG Light Flesh" }),
      row({ name: "FIG Boney White", code: "AC30" }),
    ]);
    expect(paints.map((p) => p.name)).toEqual(["Light Flesh", "Bony White"]);
  });

  it("carries the slug chosen by hand for a colliding name", () => {
    expect(imported([row({ code: "AC40" })])[0]?.slug).toBe("red-figures");
  });

  it("keeps the photo colour where the measured one is set aside", () => {
    const [paint] = imported([row({ code: "AC50", measuredHex: "#C2B193" })]);
    expect(paint?.color?.hex).toBe("#aa0000");
  });

  it("fails on anything it cannot place, instead of guessing", () => {
    expect(
      issues([
        row({ set: "Contrast" }),
        row({ name: "Plain", code: null }),
        row({ name: "Medium", colourless: true }),
        row({ name: "Blue", measuredHex: "#0000aa" }),
        row({ name: "Green", hex: null }),
      ]),
    ).toEqual([
      'Contrast / Red: unknown set "Contrast"',
      "Core / Plain: no manufacturer code",
      "Core / Medium: colourless but not excluded",
      "Core / Blue: has a measured colour, not handled yet",
      "Core / Green: invalid hex null",
    ]);
  });

  it("rejects a file without the expected shape", () => {
    expect(importDonnervS({ brands: [] }, brand, "donnervs").ok).toBe(false);
  });
});
