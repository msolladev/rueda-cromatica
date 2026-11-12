import { describe, expect, it } from "vitest";
import { mergePaints, type ImportedPaint, type PaintRow } from "./merge.ts";

const color = (hex: string) =>
  ({ hex, origin: "community", sourceId: "acme-web" }) as const;

const row = (patch: Partial<ImportedPaint> = {}): ImportedPaint => ({
  rangeId: "acme/core",
  name: "Red",
  manufacturerCode: null,
  type: "layer",
  metallic: false,
  color: color("#aa0000"),
  ...patch,
});

const stored = (patch: Partial<PaintRow> = {}): PaintRow => ({
  id: "acme/core/red",
  aliases: [],
  status: { kind: "active" },
  ...row(),
  ...patch,
});

function merged(existing: PaintRow[], imported: ImportedPaint[]) {
  const result = mergePaints(existing, imported);
  if (!result.ok) throw new Error(result.error.join("\n"));
  return result.value;
}

describe("mergePaints (docs/04 §4)", () => {
  it("proposes an ID for a new paint, active and without aliases", () => {
    const { paints } = merged([], [row({ name: "Bob's Blue" })]);
    expect(paints).toEqual([
      {
        id: "acme/core/bobs-blue",
        rangeId: "acme/core",
        name: "Bob's Blue",
        aliases: [],
        manufacturerCode: null,
        type: "layer",
        metallic: false,
        color: color("#aa0000"),
        status: { kind: "active" },
      },
    ]);
  });

  it("keeps the ID and curated fields of a paint found by name", () => {
    const existing = stored({
      id: "acme/core/red-2024",
      aliases: ["Crimson"],
      status: { kind: "discontinued", replacement: null },
    });
    const { paints } = merged([existing], [row({ color: color("#bb0000") })]);
    expect(paints).toEqual([{ ...existing, color: color("#bb0000") }]);
  });

  it("finds a paint by its code and records the old name as an alias", () => {
    const existing = stored({ manufacturerCode: "AC-01" });
    const { paints } = merged(
      [existing],
      [row({ name: "Scarlet", manufacturerCode: "AC-01" })],
    );
    expect(paints).toEqual([
      { ...existing, name: "Scarlet", aliases: ["Red"] },
    ]);
  });

  it("only matches within the same range", () => {
    const { paints } = merged(
      [stored()],
      [row({ rangeId: "acme/base", name: "Red" })],
    );
    expect(paints.map((p) => p.id)).toEqual(["acme/base/red", "acme/core/red"]);
  });

  it("keeps and lists the paints the source no longer has", () => {
    const gone = stored({ id: "acme/core/blue", name: "Blue" });
    const { paints, missing } = merged([gone], [row()]);
    expect(paints.map((p) => p.id)).toEqual([
      "acme/core/blue",
      "acme/core/red",
    ]);
    expect(missing).toEqual([gone]);
  });

  it("fails when a new paint's ID is taken, asking for a manual suffix", () => {
    const taken = stored({ name: "Red (old)" });
    const result = mergePaints([taken], [row()]);
    expect(result.ok ? [] : result.error).toEqual([
      'acme/core/red: already taken; choose a suffix by hand for "Red" (docs/03 §3)',
    ]);
  });

  it("fails when the source lists a paint twice", () => {
    const result = mergePaints([], [row(), row()]);
    expect(result.ok ? [] : result.error).toEqual([
      'acme/core: "Red" appears twice in the source',
    ]);
  });
});
