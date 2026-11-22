import { describe, expect, it } from "vitest";
import { chartCollector } from "./chart.ts";
import { valid } from "../fixtures.ts";

describe("chartCollector", () => {
  it("names each paint once, in the order it first appears", () => {
    const chart = chartCollector();
    const red = chart.paint({
      key: "A-1",
      group: "A",
      name: "Red",
      code: "A-1",
    });
    const blue = chart.paint({
      key: "B/Blue",
      group: "B",
      name: "Blue",
      code: null,
    });
    chart.equivalence(red, blue);
    chart.equivalence(
      chart.paint({ key: "A-2", group: "A", name: "Ruby", code: "A-2" }),
      chart.paint({ key: "B/Blue", group: "B", name: "Blue", code: null }),
      "Two lines.",
    );
    const { paints, equivalences } = valid(chart.result());
    expect(paints.map((p) => p.key)).toEqual(["A-1", "B/Blue", "A-2"]);
    expect(paints[1]).toEqual({
      key: "B/Blue",
      group: "B",
      name: "Blue",
      code: null,
      hex: null,
      gradient: null,
      measuredHex: null,
      finish: null,
      colourless: false,
    });
    expect(equivalences).toEqual([
      { from: "A-1", to: "B/Blue", note: null },
      { from: "A-2", to: "B/Blue", note: "Two lines." },
    ]);
  });

  it("fails if a key is written two ways", () => {
    const chart = chartCollector();
    chart.paint({ key: "A-1", group: "A", name: "Red", code: "A-1" });
    chart.paint({ key: "A-1", group: "A", name: "Rad", code: "A-1" });
    expect(chart.result()).toEqual({
      ok: false,
      error: ['"A-1" appears with different contents'],
    });
  });
});
