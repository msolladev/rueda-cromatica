import { describe, expect, it } from "vitest";
import { curated, curatedData, row } from "../fixtures.ts";
import { resolveKeys } from "./resolve.ts";

type Data = ReturnType<typeof curatedData>;

const resolve = (data: Data) => resolveKeys(curated(data));

/** `file path: message` of every issue. */
const issues = (data: Data): string[] =>
  resolve(data).issues.map((i) => `${i.file} ${i.path}: ${i.message}`);

const source = (data: Data) => {
  const [first] = data.sources;
  if (first === undefined) throw new Error("Fixture without sources");
  return first.content;
};
const acme = (data: Data) => {
  const [first] = data.brands;
  if (first === undefined) throw new Error("Fixture without brands");
  return first.content;
};

describe("resolveKeys (docs/04 §6)", () => {
  it("gives each paint the rows of its keys", () => {
    const { rows, issues: found } = resolve(curatedData());
    expect(found).toEqual([]);
    expect(rows.get("acme/core/red")?.map((r) => r.row.name)).toEqual(["Red"]);
    expect(rows.get("globex/standard/green")?.[0]?.sourceId).toBe("acme-chart");
  });

  describe("rows", () => {
    it("fails on a row that is neither a key nor ignored", () => {
      const data = curatedData();
      source(data).paints.push(row({ key: "AC-04", name: "Orange" }));
      const resolution = resolve(data);
      expect(resolution.uncovered.map((r) => r.row.key)).toEqual(["AC-04"]);
      expect(issues(data)).toEqual([
        'sources/acme-chart.json paints[5]: "AC-04" (Core) is not a key of any paint and is not ignored',
      ]);
    });

    it("fails on a key repeated in a source", () => {
      const data = curatedData();
      source(data).paints.push(row({ key: "AC-01", name: "Red again" }));
      expect(issues(data)).toEqual([
        'sources/acme-chart.json paints[5].key: Key "AC-01" is repeated',
      ]);
    });
  });

  describe("keys", () => {
    it("fails on a key that points to two paints", () => {
      const data = curatedData();
      const [, blue] = acme(data).paints;
      if (blue === undefined) throw new Error("Fixture without Blue");
      blue.keys = [{ sourceId: "acme-chart", key: "AC-01" }];
      expect(issues(data)).toEqual([
        'brands/acme.json paints[1].keys[0]: Key "AC-01" of acme-chart is also a key of acme/core/red',
        'sources/acme-chart.json paints[1]: "AC-02" (Core) is not a key of any paint and is not ignored',
      ]);
    });

    it("fails on a key that is not in its source", () => {
      const data = curatedData();
      const [red] = acme(data).paints;
      if (red === undefined) throw new Error("Fixture without Red");
      red.keys = [{ sourceId: "acme-chart", key: "AC-1" }];
      expect(issues(data)[0]).toBe(
        'brands/acme.json paints[0].keys[0]: acme-chart has no row with key "AC-1"',
      );
    });

    it("fails on a key of an unknown source", () => {
      const data = curatedData();
      const [red] = acme(data).paints;
      red?.keys.push({ sourceId: "initech-list", key: "AC-01" });
      expect(issues(data)).toEqual([
        "brands/acme.json paints[0].keys[1]: Unknown source initech-list",
      ]);
    });
  });

  describe("ignores", () => {
    it("ignores every row of an ignored group", () => {
      const data = curatedData();
      source(data).paints.push(row({ key: "AC-91", group: "Air" }));
      expect(issues(data)).toEqual([]);
    });

    it("fails on an ignored row that is a key of a paint", () => {
      const data = curatedData();
      source(data).ignoredKeys.push({
        key: "AC-01",
        reasonId: "auxiliary",
        note: null,
      });
      expect(issues(data)).toEqual([
        'sources/acme-chart.json paints[0]: "AC-01" is ignored but is a key of acme/core/red; remove the stale ignore',
      ]);
    });

    it("fails on an ignore that matches no row", () => {
      const data = curatedData();
      source(data).ignoredGroups.push({
        group: "Spray",
        reasonId: "airbrush",
        note: null,
      });
      source(data).ignoredKeys.push({
        key: "AC-99",
        reasonId: "auxiliary",
        note: null,
      });
      expect(issues(data)).toEqual([
        'sources/acme-chart.json ignoredGroups[1]: No row is in group "Spray"; remove the stale ignore',
        'sources/acme-chart.json ignoredKeys[1]: No row has key "AC-99"; remove the stale ignore',
      ]);
    });

    it("fails on a key already ignored by its group", () => {
      const data = curatedData();
      source(data).ignoredKeys.push({
        key: "AC-90",
        reasonId: "airbrush",
        note: null,
      });
      expect(issues(data)).toEqual([
        'sources/acme-chart.json ignoredKeys[1]: "AC-90" is already ignored by its group "Air"',
      ]);
    });
  });

  describe("reasons", () => {
    it("fails on an unknown reason", () => {
      const data = curatedData();
      const [ignored] = source(data).ignoredKeys;
      if (ignored === undefined) throw new Error("Fixture without ignores");
      ignored.reasonId = "no-colour";
      expect(issues(data)).toEqual([
        "sources/acme-chart.json ignoredKeys[0].reasonId: Unknown reason no-colour; add it to ignore-reasons.json",
        "ignore-reasons.json [1]: Reason auxiliary is not used by any ignore or rejected colour",
      ]);
    });

    it("fails on a reason nobody uses", () => {
      const data = curatedData();
      data.ignoreReasons.content.push({ id: "spray", text: "Spray line." });
      expect(issues(data)).toEqual([
        "ignore-reasons.json [2]: Reason spray is not used by any ignore or rejected colour",
      ]);
    });

    it("counts the reasons of rejected colours, and checks them", () => {
      const data = curatedData();
      data.ignoreReasons.content.push({ id: "spray", text: "Spray line." });
      const [red] = acme(data).paints;
      if (red === undefined) throw new Error("Fixture without paints");
      const rejection = {
        sourceId: "acme-chart",
        origin: "manufacturer",
        hex: "#aa0000",
        note: null,
      };
      red.rejectedColors = [
        { ...rejection, reasonId: "spray" },
        { ...rejection, reasonId: "faded" },
      ];
      expect(issues(data)).toEqual([
        "brands/acme.json paints[0].rejectedColors[1].reasonId: Unknown reason faded; add it to ignore-reasons.json",
      ]);
    });
  });
});
