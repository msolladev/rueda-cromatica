import { describe, expect, it } from "vitest";
import { valid } from "../fixtures.ts";
import {
  CHECKLIST_GROUP,
  FOUNDATION_GROUP,
  WASHES_GROUP,
  transcribeChecklist2004,
  transcribeFoundationPage,
  transcribeWashesPage,
} from "./games-workshop.ts";
import type { PdfTextItem } from "./pdf-text.ts";

/** Invented pots, laid out as the checklist: name, then its code. */
const at = (text: string, x: number, y: number, size: number): PdfTextItem => ({
  text,
  x,
  y,
  width: 40,
  size,
});
const pot = (name: string, code: string, x: number, y: number) => [
  at(name, x, y, 8),
  at(code, x + 73, y - 0.1, 5),
];
const page = (...items: PdfTextItem[]) => [{ width: 612, height: 396, items }];
const title = at("PAINTS & INKS RANGE CHECKLIST", 150, 60, 22);

const names = (rows: readonly { key: string; name: string }[]) =>
  rows.map((r) => [r.key, r.name]);

describe("transcribeChecklist2004", () => {
  it("reads each pot with its code, column by column", () => {
    const rows = valid(
      transcribeChecklist2004(
        page(
          title,
          ...pot("Ash Grey", "61-50", 145, 80),
          ...pot("Chalk", "61-01", 30, 100),
          ...pot("Coal", "61-02", 30, 80),
          at("Make sure you've got all of them.", 250, 340, 7.25),
        ),
      ),
    );
    expect(names(rows)).toEqual([
      ["61-02", "Coal"],
      ["61-01", "Chalk"],
      ["61-50", "Ash Grey"],
    ]);
    expect(rows[0]).toEqual({
      key: "61-02",
      group: CHECKLIST_GROUP,
      name: "Coal",
      code: "61-02",
      hex: null,
      gradient: null,
      measuredHex: null,
      finish: null,
      colourless: false,
    });
  });

  it("fails without its title, or with a name or a code left alone", () => {
    expect(
      transcribeChecklist2004(page(...pot("Coal", "61-02", 30, 80))).ok,
    ).toBe(false);
    expect(
      transcribeChecklist2004(
        page(title, at("Coal", 30, 80, 8), at("61-09", 300, 200, 5)),
      ),
    ).toEqual({
      ok: false,
      error: [
        '"Coal": expected one code on its right',
        'Code "61-09" without a name',
      ],
    });
  });
});

const img = (src: string, alt: string) =>
  `<td><img src="${src}" alt="${alt}" width="90" height="132"></td>`;

describe("transcribeFoundationPage", () => {
  it("reads the swatches of the page, named by their alt text", () => {
    const html = [
      img("/painting/images/title.gif", "Citadel Foundation Paints"),
      img("/library/foundationpaints/chalk.jpg", "Chalk"),
      img("/library/foundationpaints/coal.jpg", "Dark &#38; Coal"),
      img("/painting/foundation-paints/images/set.jpg", "Paint Set"),
    ].join("\n");
    const rows = valid(transcribeFoundationPage(html));
    expect(names(rows)).toEqual([
      ["Chalk", "Chalk"],
      ["Dark & Coal", "Dark & Coal"],
    ]);
    expect(rows.every((r) => r.group === FOUNDATION_GROUP)).toBe(true);
  });

  it("fails on a page without swatches, or a swatch without a name", () => {
    expect(transcribeFoundationPage("<p>Gone</p>").ok).toBe(false);
    expect(
      transcribeFoundationPage(img("/library/foundationpaints/x.jpg", " ")).ok,
    ).toBe(false);
  });
});

describe("transcribeWashesPage", () => {
  it("reads the pictures of the gallery, without the title or the rules", () => {
    const html = [
      img("/painting/washes/images/title.gif", "Citadel Washes"),
      img("/painting/washes/images/old_mud.jpg", "Old Mud"),
      img("/painting/washes/images/hr.gif", "Horizontal Rule"),
      img("/painting/washes/images/ink_black.jpg", "Ink Black"),
    ].join("\n");
    const rows = valid(transcribeWashesPage(html));
    expect(names(rows)).toEqual([
      ["Old Mud", "Old Mud"],
      ["Ink Black", "Ink Black"],
    ]);
    expect(rows.every((r) => r.group === WASHES_GROUP)).toBe(true);
  });
});
