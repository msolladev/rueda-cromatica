import { describe, expect, it } from "vitest";
import { importerOf } from "./registry.ts";

describe("importerOf (docs/04 §7)", () => {
  it("has no importer for a source that is not imported again", () => {
    expect(importerOf("games-workshop-citadel-conversion-chart-2012")).toBe(
      null,
    );
  });

  it("reads each chart as one PDF, with its key rules", () => {
    const chart = importerOf("vallejo-cc266");
    expect(chart?.format).toBe("pdf");
    expect(chart?.rules).toBeNull();
    expect(chart?.keys).not.toBeNull();
    if (chart?.format !== "pdf") throw new Error("Expected a PDF importer");
    expect(chart.transcribe([[], []])).toEqual({
      ok: false,
      error: ["Expected one file, got 2"],
    });
  });

  it("fails on a DonnervS file that is not JSON", () => {
    const donnervs = importerOf("donnervs-miniature-paints");
    if (donnervs?.format !== "text") throw new Error("Expected text");
    const result = donnervs.transcribe([{ name: "AK.json", text: "{" }]);
    expect(result.ok).toBe(false);
  });
});
