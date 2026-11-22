import { describe, expect, it } from "vitest";
import { valid } from "../fixtures.ts";
import type { PdfTextItem } from "./pdf-text.ts";
import { transcribeCc266 } from "./vallejo-cc266.ts";

/** An invented chart with the layout of CC266: the tables in the last panel. */
const at = (text: string, x: number, y: number, size = 5): PdfTextItem => ({
  text,
  x,
  y,
  width: 20,
  size,
});
const header = (text: string, x: number, y: number) => at(text, x, y, 6);

/** The x of each column: the Game Color table on the left, the others right. */
const [c, n, ga, gan, hp, hpn, cit] = [
  500, 514, 548, 562, 596, 610, 645,
] as const;
const [rc, rn, rcit] = [700, 714, 745] as const;

function chart(extra: PdfTextItem[] = []) {
  const items: PdfTextItem[] = [
    at("Game Color equivalences", 502, 30, 10),
    at("Invented on the left panel", 10, 30, 10),
    // Game Color table, left.
    header("GC", c, 60),
    header("Game Color", n, 60),
    header("GA", ga, 60),
    header("Game Air", gan, 60),
    header("HP", hp, 60),
    header("Hobby Paint", hpn, 60),
    header("Citadel", cit, 63),
    ...[c, n, ga, gan, hp, hpn].map((x, i) =>
      header(i % 2 === 0 ? "ref." : "descrip.", x, 66),
    ),
    at("72.900", c, 76),
    at("Test White", n, 76),
    at("76.900", ga, 76),
    at("Test White", gan, 76),
    at("Chalk Scar", cit, 76),
    at("72.901", c, 86),
    at("Test Grey", n, 86),
    at("28.901", hp, 86),
    at("Test Grey", hpn, 86),
    // Wash table, right.
    header("Ref.", rc, 243),
    header("Game Color", rn, 243),
    header("Citadel", rcit, 246),
    header("GC-W", rc, 249),
    header("Wash", rn, 249),
    at("73.900", rc, 260),
    at("Test Wash", rn, 260),
    at("Mud Shade", rcit, 260),
    // Xpress table, right, with a cell of two lines.
    header("Ref.", rc, 298),
    header("Xpress Color", rn, 301),
    header("Citadel", rcit, 301),
    header("XC", rc, 304),
    at("72.990", rc, 314),
    at("Test Bone", rn, 314),
    at("Bone Layer", rcit, 311.5),
    at("(Layer)", rcit, 316.5),
    at("Legal notice.", rc, 520, 4.75),
    ...extra,
  ];
  return [{ width: 600, height: 595, items }];
}

describe("transcribeCc266", () => {
  it("reads the three tables, with each Vallejo paint as the origin", () => {
    const { paints, equivalences } = valid(transcribeCc266(chart()));
    expect(paints.map((p) => [p.key, p.group, p.name, p.code])).toEqual([
      ["72.900", "Game Color", "Test White", "72.900"],
      ["76.900", "Game Air", "Test White", "76.900"],
      ["Citadel/Chalk Scar", "Citadel", "Chalk Scar", null],
      ["72.901", "Game Color", "Test Grey", "72.901"],
      ["28.901", "Hobby Paint", "Test Grey", "28.901"],
      ["73.900", "Game Color Wash", "Test Wash", "73.900"],
      ["Citadel/Mud Shade", "Citadel", "Mud Shade", null],
      ["72.990", "Xpress Color", "Test Bone", "72.990"],
      ["Citadel/Bone Layer (Layer)", "Citadel", "Bone Layer (Layer)", null],
    ]);
    expect(equivalences.map((e) => `${e.from} → ${e.to}`)).toEqual([
      "72.900 → 76.900",
      "72.900 → Citadel/Chalk Scar",
      "72.901 → 28.901",
      "73.900 → Citadel/Mud Shade",
      "72.990 → Citadel/Bone Layer (Layer)",
    ]);
  });

  it("fails on text that is in no cell", () => {
    const result = transcribeCc266(chart([at("Stray", 640, 90)]));
    expect(result.ok).toBe(false);
  });

  it("fails if the headers change", () => {
    const result = transcribeCc266([
      {
        width: 600,
        height: 595,
        items: [
          at("Game Color equivalences", 502, 30, 10),
          header("GC", 500, 60),
          header("Game Colour", 514, 60),
        ],
      },
    ]);
    expect(result.ok).toBe(false);
  });

  it("fails without the panel of equivalences", () => {
    expect(transcribeCc266([{ width: 600, height: 595, items: [] }])).toEqual({
      ok: false,
      error: [
        'No "Game Color equivalences" in the last panel of the first page',
      ],
    });
  });
});
