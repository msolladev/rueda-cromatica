import { describe, expect, it } from "vitest";
import { transcribeArcturus } from "./arcturus.ts";

// Fictitious rows in the layout of the Arcturus5404 Markdown tables.
const swatch = (hex: string) =>
  `![${hex}](https://placehold.co/15x15/${hex.slice(1)}/${hex.slice(1)}.png) \`${hex}\``;
const table = (...rows: string[]) =>
  [
    "# Acme",
    '![Acme](../logos/Acme.png "Acme")',
    "",
    "|Name|Code|Set|R|G|B|Hex|",
    "|---|---|---|---|---|---|---|",
    ...rows,
  ].join("\n");
const row = (name: string, code: string, set: string, hex: string) =>
  `|${name}|${code}|${set}|1|2|3|${swatch(hex)}|`;

describe("transcribeArcturus", () => {
  it("copies each row literally, keyed by its set and name", () => {
    const result = transcribeArcturus([
      table(
        row("Matt White", "AC1102", "Core", "#FFFFFF"),
        row("Matt White", "null", "Starter Set", "#FEFEFE"),
      ),
    ]);
    expect(result).toEqual({
      ok: true,
      value: [
        {
          key: "Core/Matt White",
          group: "Core",
          name: "Matt White",
          code: "AC1102",
          hex: "#FFFFFF",
          gradient: null,
          measuredHex: null,
          finish: null,
          colourless: false,
        },
        {
          key: "Starter Set/Matt White",
          group: "Starter Set",
          name: "Matt White",
          code: null,
          hex: "#FEFEFE",
          gradient: null,
          measuredHex: null,
          finish: null,
          colourless: false,
        },
      ],
    });
  });

  it("fails if the header changes", () => {
    const result = transcribeArcturus([table().replace("|Hex|", "|Colour|")]);
    expect(result.ok).toBe(false);
  });

  it("fails on a row without a hex or with missing cells", () => {
    const result = transcribeArcturus([
      table("|Red|AC01|Core|1|2|3|#AA0000|", "|Blue|AC02|Core|"),
    ]);
    expect(result).toEqual({
      ok: false,
      error: [
        "File 1, row 1: unexpected cells: Red|AC01|Core|1|2|3|#AA0000",
        "File 1, row 2: unexpected cells: Blue|AC02|Core",
      ],
    });
  });

  it("keys a repeated set and name by its occurrence (ADR-0035)", () => {
    const result = transcribeArcturus([
      table(
        row("Red", "AC01", "Core", "#AA0000"),
        row("Red", "AC02", "Core", "#AB0000"),
      ),
    ]);
    expect(result.ok && result.value.map((r) => [r.key, r.hex])).toEqual([
      ["Core/Red", "#AA0000"],
      ["Core/Red (2)", "#AB0000"],
    ]);
  });

  it("reads the tables without a code column, file after file", () => {
    const citadel = [
      "|Name|Set|R|G|B|Hex|",
      "|---|---|---|---|---|---|",
      `|Regal Blue|Foundation (discontinued)|0|63|112|${swatch("#003F70")}|`,
    ].join("\n");
    const result = transcribeArcturus([
      table(row("Matt White", "AC1102", "Core", "#FFFFFF")),
      citadel,
    ]);
    expect(result.ok && result.value.map((r) => [r.key, r.code])).toEqual([
      ["Core/Matt White", "AC1102"],
      ["Foundation (discontinued)/Regal Blue", null],
    ]);
  });
});
