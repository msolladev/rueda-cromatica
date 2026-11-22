import { sourceIdSchema } from "@chromatic-wheel/domain";
import { describe, expect, it } from "vitest";
import { sourceRowSchema } from "../curated/files.ts";
import {
  acmeSource,
  curated,
  curatedData,
  patchPaint,
  row,
  type Fixtures,
} from "../fixtures.ts";
import { proposeKeys, type KeyRules } from "./chart-keys.ts";

/** An invented chart of Hooli that names Acme and Globex paints. */
function withChart(): Fixtures {
  const data = curatedData();
  const acme = acmeSource();
  data.sources.push({
    name: "sources/hooli-chart.json",
    content: {
      ...acme.content,
      source: { ...acme.content.source, id: "hooli-chart", title: "Hooli" },
      paints: [],
      ignoredGroups: [],
      ignoredKeys: [],
    },
  });
  return data;
}

const brand = (data: Fixtures, index: number) => {
  const file = data.brands[index];
  if (file === undefined) throw new Error("Fixture without that brand");
  return file;
};

const chartRow = (key: string, group: string, name: string, code = "") =>
  sourceRowSchema.parse(
    row({ key, group, name, code: code === "" ? null : code, hex: null }),
  );

const rules: KeyRules = {
  Acme: { brandId: "acme", by: "name" },
  "Acme code": { brandId: "acme", by: "code", code: (c) => `AC-${c}` },
  Globex: { brandId: "globex", rangeIds: ["globex/other"], by: "name" },
};

const run = (data: Fixtures, ...rows: ReturnType<typeof chartRow>[]) =>
  proposeKeys({
    current: curated(data),
    sourceId: sourceIdSchema.parse("hooli-chart"),
    rows,
    rules,
  });

describe("proposeKeys (ADR-0033)", () => {
  it("keys a row to the one paint with its code, or its name", () => {
    const data = withChart();
    patchPaint(brand(data, 0), 1, { aliases: ["Sky’s Blue"] });
    const { added, unmatched, brands } = run(
      data,
      chartRow("Acme code/01", "Acme code", "", "01"),
      chartRow("Acme/Sky's Blue", "Acme", "Sky's Blue"),
    );
    expect(added).toEqual([
      { paintId: "acme/core/red", key: "Acme code/01" },
      { paintId: "acme/core/blue", key: "Acme/Sky's Blue" },
    ]);
    expect(unmatched).toEqual([]);
    expect(brands.map((b) => b.name)).toEqual(["brands/acme.json"]);
    const red = brands[0]?.paints.find((p) => p.id === "acme/core/red");
    expect(red?.keys).toEqual([
      { sourceId: "acme-chart", key: "AC-01" },
      { sourceId: "hooli-chart", key: "Acme code/01" },
    ]);
  });

  it("leaves to decide a paint claimed twice, or a name of two paints", () => {
    const data = withChart();
    patchPaint(brand(data, 0), 1, { name: "Red" });
    const { added, unmatched } = run(
      data,
      chartRow("Acme/Red", "Acme", "Red"),
      chartRow("Acme code/02", "Acme code", "", "02"),
      chartRow("Acme code/03", "Acme code", "", "03"),
    );
    expect(added).toEqual([{ paintId: "acme/core/blue", key: "Acme code/02" }]);
    expect(unmatched).toEqual([
      { key: "Acme/Red", candidates: ["acme/core/red", "acme/core/blue"] },
      { key: "Acme code/03", candidates: [] },
    ]);
  });

  it("only looks in the ranges of the rule, and skips groups without one", () => {
    const { added, unmatched } = run(
      withChart(),
      chartRow("Globex/Green", "Globex", "Green"),
      chartRow("Other/Red", "Other", "Red"),
    );
    expect(added).toEqual([]);
    expect(unmatched).toEqual([{ key: "Globex/Green", candidates: [] }]);
  });

  it("skips ignored rows and paints already keyed to the chart", () => {
    const data = withChart();
    const chart = data.sources[1]?.content;
    if (chart === undefined) throw new Error("Fixture without the chart");
    chart.paints = [row({ key: "Acme/Blue", group: "Acme", name: "Blue" })];
    chart.ignoredKeys = [
      { key: "Acme/Blue", reasonId: "auxiliary", note: null },
    ];
    patchPaint(brand(data, 0), 0, {
      keys: [
        { sourceId: "acme-chart", key: "AC-01" },
        { sourceId: "hooli-chart", key: "Acme/Red" },
      ],
    });
    chart.paints.push(row({ key: "Acme/Red", group: "Acme", name: "Red" }));
    const { added, unmatched } = run(
      data,
      chartRow("Acme/Blue", "Acme", "Blue"),
      chartRow("Acme/Red", "Acme", "Red"),
      chartRow("Acme/Red again", "Acme", "Red"),
    );
    expect(added).toEqual([]);
    expect(unmatched).toEqual([{ key: "Acme/Red again", candidates: [] }]);
  });
});
