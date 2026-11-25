import { describe, expect, it } from "vitest";
import { sourceRowSchema } from "../model/curated.ts";
import {
  acmeSource,
  curated,
  curatedData,
  row,
  valid,
  withChart,
  type Fixtures,
  type Row,
} from "../fixtures.ts";
import { importSource } from "./import-source.ts";
import type { ProposalRules } from "./reconcile.ts";

const rules: ProposalRules = {
  groups: { Core: { rangeId: "acme/core", type: "standard", metallic: false } },
};

/** The rows of the fixture source, plus some new ones. */
const rowsWith = (...rows: Row[]) =>
  [...acmeSource().content.paints, ...rows].map((r) =>
    sourceRowSchema.parse(r),
  );

/** Imports into the source of `data` named `sourceId`. */
function run(
  data: Fixtures,
  sourceId: string,
  importer: Parameters<typeof importSource>[0]["importer"],
  ...rows: Row[]
) {
  const current = curated(data);
  const source = current.sources.find((s) => s.source.id === sourceId);
  if (source === undefined) throw new Error("Fixture without that source");
  return importSource({
    curated: current,
    source,
    importer,
    transcription: {
      paints: rows.map((r) => sourceRowSchema.parse(r)),
      equivalences: [],
    },
  });
}

describe("importSource (docs/04 §7)", () => {
  it("changes no brand when the transcription is the same", () => {
    const imported = valid(
      run(
        curatedData(),
        "acme-chart",
        { rules, keys: null },
        ...acmeSource().content.paints,
      ),
    );
    expect(imported.source.paints).toEqual(rowsWith());
    expect(imported.brands).toEqual([]);
    expect(imported.keys).toBeNull();
  });

  it("gives the source with its new rows and the brand with its proposal", () => {
    const orange = row({ key: "AC-04", name: "Orange" });
    const imported = valid(
      run(
        curatedData(),
        "acme-chart",
        { rules, keys: null },
        ...acmeSource().content.paints,
        orange,
      ),
    );
    expect(imported.source.name).toBe("sources/acme-chart.json");
    expect(imported.source.paints).toEqual(rowsWith(orange));
    expect(imported.proposals.map((p) => p.id)).toEqual(["acme/core/orange"]);
    expect(
      imported.brands.map((b) => [b.name, b.paints.map((p) => p.id)]),
    ).toEqual([
      [
        "brands/acme.json",
        ["acme/core/blue", "acme/core/orange", "acme/core/red"],
      ],
    ]);
  });

  it("keys the rows of a chart to their paints before reconciling", () => {
    const imported = valid(
      run(
        withChart(),
        "hooli-chart",
        { rules: null, keys: { Acme: { brandId: "acme", by: "name" } } },
        row({ key: "H-1", group: "Acme", name: "Red", hex: null }),
      ),
    );
    expect(imported.keys?.added).toEqual([
      { paintId: "acme/core/red", key: "H-1" },
    ]);
    const red = imported.brands
      .flatMap((b) => b.paints)
      .find((p) => p.id === "acme/core/red");
    expect(red?.keys).toContainEqual({ sourceId: "hooli-chart", key: "H-1" });
    expect(imported.pending).toEqual([]);
  });

  it("fails as the reconciliation does", () => {
    const result = run(
      curatedData(),
      "acme-chart",
      { rules, keys: null },
      ...acmeSource().content.paints,
      row({ key: "AC-50", group: "Unknown" }),
    );
    expect(result.ok).toBe(false);
  });
});
