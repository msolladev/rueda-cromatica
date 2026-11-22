import { describe, expect, it } from "vitest";
import {
  catalogOf,
  find,
  insertEdges,
  insertSorted,
  paintId,
  validDraft,
} from "../catalog/fixtures.ts";
import { realCatalog } from "./fixtures.ts";
import { findOfficialEquivalences } from "./official-equivalences.ts";

function found(...args: Parameters<typeof findOfficialEquivalences>) {
  const result = findOfficialEquivalences(...args);
  if (!result.ok) throw new Error(result.error.kind);
  return result.value;
}

const summary = (matches: ReturnType<typeof found>["outgoing"]) =>
  matches.map((m) => [
    m.paint.id,
    m.sources.map((s) => s.id),
    m.deltaE2000 === null ? null : Math.round(m.deltaE2000 * 10) / 10,
    m.quality,
  ]);

describe("findOfficialEquivalences (docs/06 §10)", () => {
  it("gives both directions of a real paint, measured against a colour", () => {
    // Vallejo 72.051 Black, with its own colour as the wheel's.
    const black = found(
      realCatalog(),
      paintId("vallejo/game-color/black"),
      "#000000",
    );
    expect(summary(black.outgoing)).toEqual([
      ["citadel/base/abaddon-black", ["vallejo-cc266"], 3.7, "similar"],
    ]);
    expect(summary(black.incoming)).toEqual([
      [
        "ak-interactive/3gen-acrylics/black",
        ["ak-interactive-3gen-equivalence-table"],
        3.9,
        "similar",
      ],
    ]);
    expect(black.outgoing[0]?.brand.id).toBe("citadel");
    expect(black.outgoing[0]?.approximate).toBe(true);
  });

  it("never infers an inverse or a transitive edge (ADR-0004)", () => {
    const catalog = realCatalog();
    const abaddon = found(
      catalog,
      paintId("citadel/base/abaddon-black"),
      "#141314",
    );
    expect(abaddon.outgoing).toEqual([]);
    expect(abaddon.incoming.map((m) => m.paint.id)).toEqual([
      "ak-interactive/3gen-acrylics/black",
      "the-army-painter/warpaints-fanatic/matt-black",
      "vallejo/game-color/black",
    ]);
    // Matt Black → Abaddon Black and Abaddon Black ← 72.051 say nothing of
    // Matt Black and 72.051.
    const matt = found(
      catalog,
      paintId("the-army-painter/warpaints-fanatic/matt-black"),
      "#070706",
    );
    expect(matt.outgoing.map((m) => m.paint.id)).toEqual([
      "citadel/base/abaddon-black",
    ]);
    expect(matt.incoming).toEqual([]);
  });

  it("joins the documents that state the same edge", () => {
    const draft = validDraft();
    insertSorted(draft.sources, {
      ...find(draft.sources, "acme-conversion-chart"),
      id: "acme-reprint",
      title: "Acme chart, reprint",
    });
    insertEdges(draft.equivalences, {
      from: "acme/core/deep-red",
      to: "globex/standard/crimson",
      sourceId: "acme-reprint",
    });
    const deepRed = found(
      catalogOf(draft),
      paintId("acme/core/deep-red"),
      "#aa0000",
    );
    expect(deepRed.outgoing.map((m) => m.sources.map((s) => s.id))).toEqual([
      ["acme-conversion-chart", "acme-reprint"],
    ]);
  });

  it("gives no ΔE for a paint without colour", () => {
    const draft = validDraft();
    find(draft.paints, "globex/standard/crimson").color = null;
    const deepRed = found(
      catalogOf(draft),
      paintId("acme/core/deep-red"),
      "#aa0000",
    );
    expect(deepRed.outgoing[0]).toMatchObject({
      deltaE2000: null,
      quality: null,
    });
  });

  it("rejects a colour that is not #rrggbb, and a paint not in the catalog", () => {
    const catalog = catalogOf(validDraft());
    expect(
      findOfficialEquivalences(catalog, paintId("acme/core/deep-red"), "red"),
    ).toEqual({
      ok: false,
      error: { kind: "invalid-color", color: "red" },
    });
    expect(() =>
      findOfficialEquivalences(catalog, paintId("acme/core/nope"), "#000000"),
    ).toThrow("Paint acme/core/nope is not in the catalog");
  });
});
