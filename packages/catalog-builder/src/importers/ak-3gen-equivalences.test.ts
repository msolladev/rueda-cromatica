import { describe, expect, it } from "vitest";
import { valid } from "../fixtures.ts";
import { transcribeAk3GenEquivalences } from "./ak-3gen-equivalences.ts";
import type { PdfTextItem } from "./pdf-text.ts";

/** Invented rows, centred in the columns as in the AK table. */
const CENTRES = [65, 120, 200, 305, 405, 510];
const cell = (
  text: string,
  column: number,
  y: number,
  size = 5,
): PdfTextItem => ({
  text,
  x: (CENTRES[column] ?? 0) - text.length,
  y,
  width: text.length * 2,
  size,
});
const HEADERS = [
  "Ref.",
  "Color",
  "Vallejo MC",
  "Vallejo GC",
  "New Citadel",
  "Old Citadel",
];
const header = (y: number, names = HEADERS) =>
  names.map((name, i) => cell(name, i, y));

const page = (...items: PdfTextItem[]) => ({ width: 595, height: 842, items });

describe("transcribeAk3GenEquivalences", () => {
  it("reads each row, splitting a cell of two codes", () => {
    const pdf = [
      page(
        cell("EQUIVALENCE TABLE", 0, 30, 14.5),
        ...header(68),
        cell("AK90001", 0, 80),
        cell("901", 2, 80),
        cell("001/002", 3, 80),
        cell("Chalk Scar", 4, 80),
        cell("Old Chalk", 5, 80),
        cell("AK90002", 0, 92),
        cell("Q", 2, 120, 2.98), // a letter of the logo
        ...header(775, [
          "Ref.",
          "Color",
          "Vallejo",
          "Vallejo GC",
          "New Citadel",
          "Old Citadel",
        ]),
      ),
      page(...header(68), cell("AK90003", 0, 80), cell("901", 2, 80)),
    ];
    const { paints, equivalences } = valid(transcribeAk3GenEquivalences(pdf));
    expect(paints.map((p) => [p.key, p.group, p.name, p.code])).toEqual([
      ["AK90001", "AK 3G", "", "AK90001"],
      ["Vallejo MC/901", "Vallejo MC", "", "901"],
      ["Vallejo GC/001", "Vallejo GC", "", "001"],
      ["Vallejo GC/002", "Vallejo GC", "", "002"],
      ["New Citadel/Chalk Scar", "New Citadel", "Chalk Scar", null],
      ["Old Citadel/Old Chalk", "Old Citadel", "Old Chalk", null],
      ["AK90002", "AK 3G", "", "AK90002"],
      ["AK90003", "AK 3G", "", "AK90003"],
    ]);
    expect(equivalences).toEqual([
      { from: "AK90001", to: "Vallejo MC/901", note: null },
      { from: "AK90001", to: "Vallejo GC/001", note: "Casilla «001/002»." },
      { from: "AK90001", to: "Vallejo GC/002", note: "Casilla «001/002»." },
      { from: "AK90001", to: "New Citadel/Chalk Scar", note: null },
      { from: "AK90001", to: "Old Citadel/Old Chalk", note: null },
      { from: "AK90003", to: "Vallejo MC/901", note: null },
    ]);
  });

  it("fails on text outside a row, or in the colour column", () => {
    const pdf = [
      page(
        ...header(68),
        cell("AK90001", 0, 80),
        cell("Stray", 3, 86),
        cell("Text", 1, 80),
      ),
    ];
    expect(transcribeAk3GenEquivalences(pdf)).toEqual({
      ok: false,
      error: [
        'page 1, "Stray" at (300, 86) is in no free cell',
        'AK90001: text "Text" in the colour column',
      ],
    });
  });

  it("fails on a repeated header with other words", () => {
    const pdf = [page(...header(68), ...header(775, ["Ref.", "Colour"]))];
    expect(transcribeAk3GenEquivalences(pdf)).toEqual({
      ok: false,
      error: ['page 1, "Colour" at (114, 775) is in a repeated header'],
    });
  });
});
