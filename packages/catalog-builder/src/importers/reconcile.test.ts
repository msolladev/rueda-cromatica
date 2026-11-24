import { sourceIdSchema } from "@chromatic-wheel/domain";
import { describe, expect, it } from "vitest";
import { sourceRowSchema } from "../model/curated.ts";
import { curated, curatedData, row, valid, type Row } from "../fixtures.ts";
import { reconcile, type ProposalRules } from "./reconcile.ts";

const current = () => curated();

const rules: ProposalRules = {
  groups: { Core: { rangeId: "acme/core", type: "standard", metallic: false } },
  name: (r) => r.name.replace(/^FIG /, ""),
  metallic: (r) => r.finish === "metal",
};

/** The rows of the fixture source, with some added or changed. */
const rowsWith = (...rows: Row[]) => {
  const base = curatedData().sources[0]?.content.paints ?? [];
  const keys = new Set(rows.map((r) => r.key));
  return [...base.filter((r) => !keys.has(r.key)), ...rows].map((r) =>
    sourceRowSchema.parse(r),
  );
};

const run = (...rows: Row[]) =>
  reconcile({
    current: current(),
    sourceId: sourceIdSchema.parse("acme-chart"),
    rows: rowsWith(...rows),
    rules,
  });

describe("reconcile (docs/04 §7)", () => {
  it("changes nothing when the transcription is the same", () => {
    expect(valid(run())).toEqual({
      proposals: [],
      brands: [],
      differences: [],
      pending: [],
    });
  });

  it("proposes a paint for a new row, keyed to it", () => {
    const { proposals, brands, pending } = valid(
      run(row({ key: "AC-04", name: "FIG Orange", finish: "metal" })),
    );
    expect(brands.map((b) => [b.name, b.paints.map((p) => p.id)])).toEqual([
      [
        "brands/acme.json",
        ["acme/core/blue", "acme/core/orange", "acme/core/red"],
      ],
    ]);
    expect(proposals).toEqual([
      {
        id: "acme/core/orange",
        rangeId: "acme/core",
        name: "Orange",
        aliases: [],
        manufacturerCode: "AC-04",
        type: "standard",
        metallic: true,
        status: { kind: "active" },
        keys: [{ sourceId: "acme-chart", key: "AC-04" }],
        colorChoice: null,
        rejectedColors: [],
        note: null,
      },
    ]);
    expect(pending).toEqual([]);
  });

  it("fails on a new row of a group without a rule", () => {
    expect(run(row({ key: "AC-50", group: "Inks" }))).toEqual({
      ok: false,
      error: [
        '"AC-50" (Inks): no rule for its group; ignore it, or add it by hand as a key of an existing paint or of a new one',
      ],
    });
  });

  it("leaves new rows pending for a source without rules", () => {
    const result = valid(
      reconcile({
        current: current(),
        sourceId: sourceIdSchema.parse("acme-chart"),
        rows: rowsWith(row({ key: "AC-50", group: "Inks" })),
        rules: null,
      }),
    );
    expect(result.proposals).toEqual([]);
    expect(result.pending.map((i) => i.message)).toEqual([
      '"AC-50" (Inks) is not a key of any paint and is not ignored',
    ]);
  });

  it("fails when the proposed ID is taken, so the suffix is chosen by hand", () => {
    expect(run(row({ key: "AC-05", name: "Red" }))).toEqual({
      ok: false,
      error: [
        '"AC-05": acme/core/red is already taken; add its paint by hand with a suffix (docs/03 §3)',
      ],
    });
  });

  it("reports a changed row that differs from its paint, without changing it", () => {
    const { differences, proposals } = valid(
      run(
        row({ key: "AC-01", name: "Crimson", code: "AC-001", hex: "#AA0000" }),
      ),
    );
    expect(proposals).toEqual([]);
    expect(differences).toEqual([
      {
        paintId: "acme/core/red",
        field: "name",
        source: "Crimson",
        curated: "Red",
      },
      {
        paintId: "acme/core/red",
        field: "manufacturerCode",
        source: "AC-001",
        curated: "AC-01",
      },
    ]);
  });

  it("does not report a known difference again if the row did not change", () => {
    const data = current();
    const [red] = data.brands[0]?.paints ?? [];
    if (red === undefined) throw new Error("Fixture without Red");
    const brands = data.brands.map((b, i) =>
      i === 0
        ? { ...b, paints: [{ ...red, name: "Acme Red" }, ...b.paints.slice(1)] }
        : b,
    );
    const result = reconcile({
      current: { ...data, brands },
      sourceId: sourceIdSchema.parse("acme-chart"),
      rows: rowsWith(),
      rules,
    });
    expect(valid(result).differences).toEqual([]);
  });

  it("lists as pending a paint whose row is gone", () => {
    const rows = rowsWith().filter((r) => r.key !== "AC-02");
    const result = reconcile({
      current: current(),
      sourceId: sourceIdSchema.parse("acme-chart"),
      rows,
      rules,
    });
    expect(valid(result).pending.map((i) => i.message)).toEqual([
      'acme-chart has no row with key "AC-02"',
    ]);
  });
});
