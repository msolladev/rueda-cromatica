import { describe, expect, it } from "vitest";
import { valid } from "../fixtures.ts";
import { transcribeFanaticChart } from "./fanatic-conversion-chart.ts";
import type { PdfTextItem } from "./pdf-text.ts";

/** Invented colours, laid out as the chart: name, then WP, AIR and GW. */
const at = (text: string, x: number, y: number, size: number): PdfTextItem => ({
  text,
  x,
  y,
  width: 30,
  size,
});
const name = (text: string, x: number, y: number) => at(text, x, y, 6);
const slot = (text: string, x: number, y: number) => at(text, x, y, 5);

const page = (...items: PdfTextItem[]) => [{ width: 1190, height: 842, items }];

const chart = () =>
  page(
    at("FANATIC CHART", 15, 40, 38),
    // Second column, first: the order is by column.
    name("Ash", 150, 80),
    slot("Old Ash", 150.2, 87.4),
    name("Coal", 50, 120),
    slot("Coal", 50, 134.6),
    slot("Night Black", 50, 141.8),
    name("Chalk", 50, 80),
    name("Chalk", 50, 80), // drawn twice
    slot("Old Chalk", 50, 87.4),
    slot("Air Chalk", 50, 94.6),
    slot("Bone White", 50, 101.8),
    slot("Bone White", 50, 101.8),
    name("Empty", 250, 80),
    at("v1.0", 15, 826, 6),
    at("Note: invented.", 35, 826, 6),
  );

describe("transcribeFanaticChart", () => {
  it("reads each colour and its slots, column by column", () => {
    const { paints, equivalences } = valid(transcribeFanaticChart(chart()));
    expect(paints.map((p) => [p.key, p.group, p.name])).toEqual([
      ["Fanatic/Chalk", "Warpaints Fanatic", "Chalk"],
      ["WP/Old Chalk", "Original Warpaints", "Old Chalk"],
      ["AIR/Air Chalk", "Warpaints Air", "Air Chalk"],
      ["GW/Bone White", "Citadel by Games Workshop", "Bone White"],
      ["Fanatic/Coal", "Warpaints Fanatic", "Coal"],
      ["AIR/Coal", "Warpaints Air", "Coal"],
      ["GW/Night Black", "Citadel by Games Workshop", "Night Black"],
      ["Fanatic/Ash", "Warpaints Fanatic", "Ash"],
      ["WP/Old Ash", "Original Warpaints", "Old Ash"],
      ["Fanatic/Empty", "Warpaints Fanatic", "Empty"],
    ]);
    expect(paints.every((p) => p.code === null && p.hex === null)).toBe(true);
    expect(equivalences.map((e) => `${e.from} → ${e.to}`)).toEqual([
      "Fanatic/Chalk → WP/Old Chalk",
      "Fanatic/Chalk → AIR/Air Chalk",
      "Fanatic/Chalk → GW/Bone White",
      "Fanatic/Coal → AIR/Coal",
      "Fanatic/Coal → GW/Night Black",
      "Fanatic/Ash → WP/Old Ash",
    ]);
  });

  it("fails on a suggestion that is in no slot", () => {
    const pdf = page(name("Chalk", 50, 80), slot("Lost", 50, 91));
    expect(transcribeFanaticChart(pdf)).toEqual({
      ok: false,
      error: ['"Lost" at (50, 91) is in no slot of any colour'],
    });
  });

  it("fails on a PDF that is not one page", () => {
    expect(transcribeFanaticChart([])).toEqual({
      ok: false,
      error: ["Expected one page, got 0"],
    });
  });
});
