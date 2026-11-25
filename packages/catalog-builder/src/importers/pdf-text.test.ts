import { describe, expect, it } from "vitest";
import { cellText, textItems, type PdfTextItem } from "./pdf-text.ts";

const item = (text: string, x = 0, y = 0): PdfTextItem => ({
  text,
  x,
  y,
  width: 10,
  size: 5,
});

describe("textItems", () => {
  it("drops empty items and exact repetitions", () => {
    const page = {
      width: 100,
      height: 100,
      items: [item("Red"), item(" "), item("Red"), item("Red", 0, 9), item("")],
    };
    expect(textItems(page).map((i) => [i.text, i.y])).toEqual([
      ["Red", 0],
      ["Red", 9],
    ]);
  });
});

describe("cellText", () => {
  it("joins the lines of a cell with one space", () => {
    expect(cellText([item(" Deep  Red"), item("(Layer) ")])).toBe(
      "Deep Red (Layer)",
    );
  });
});
