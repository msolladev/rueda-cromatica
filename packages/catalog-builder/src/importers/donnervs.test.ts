import { describe, expect, it } from "vitest";
import { importDonnervS, type DonnervSBrand } from "./donnervs.ts";

const brand: DonnervSBrand = {
  file: "paints/json/Acme.json",
  lines: {
    Core: { rangeId: "acme/core", type: "standard", metallic: false },
    Metals: { rangeId: "acme/core", type: "standard", metallic: true },
    Air: null,
  },
  metallics: new Set(["Steel"]),
  excluded: new Set(["Matt Varnish"]),
  nameErrata: { "Boney White": "Bony White" },
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

  it("flags metallics by set or by name", () => {
    const paints = imported([
      row({ name: "Gold", set: "Metals" }),
      row({ name: "Steel" }),
      row({ name: "Red" }),
    ]);
    expect(paints.map((p) => p.metallic)).toEqual([true, true, false]);
  });

  it("leaves out sets outside the MVP and excluded products", () => {
    expect(
      imported([row({ set: "Air" }), row({ name: "Matt Varnish" })]),
    ).toEqual([]);
  });

  it("corrects the names the file misspells", () => {
    expect(imported([row({ name: "Boney White" })])[0]?.name).toBe(
      "Bony White",
    );
  });

  it("fails on anything it cannot place, instead of guessing", () => {
    expect(
      issues([
        row({ set: "Contrast" }),
        row({ name: "Medium", colourless: true }),
        row({ name: "Blue", measuredHex: "#0000aa" }),
        row({ name: "Green", hex: null }),
      ]),
    ).toEqual([
      'Contrast / Red: unknown set "Contrast"',
      "Core / Medium: colourless but not excluded",
      "Core / Blue: has a measured colour, not handled yet",
      "Core / Green: invalid hex null",
    ]);
  });

  it("rejects a file without the expected shape", () => {
    expect(importDonnervS({ brands: [] }, brand, "donnervs").ok).toBe(false);
  });
});
