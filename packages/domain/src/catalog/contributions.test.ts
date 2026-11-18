import { describe, expect, it } from "vitest";
import { sourceContributions } from "./contributions.ts";
import { catalogOf, draftPaint, insertSorted, validDraft } from "./fixtures.ts";

describe("sourceContributions", () => {
  it("lists every source in catalog order with what it backs", () => {
    const result = sourceContributions(catalogOf(validDraft()));

    expect(result.map((c) => c.source.id)).toEqual([
      "acme-conversion-chart",
      "community-hex",
    ]);
    const [chart, community] = result;
    expect(chart?.colors.map((c) => c.brand.id)).toEqual(["acme"]);
    expect(chart?.colors[0]?.ranges.map((r) => r.id)).toEqual(["acme/core"]);
    expect(chart?.colors[0]?.paintCount).toBe(1);
    expect(chart?.replacementCount).toBe(1);
    expect(chart?.officialEquivalenceCount).toBe(1);
    expect(community?.colors.map((c) => c.brand.id)).toEqual(["globex"]);
    expect(community?.replacementCount).toBe(0);
    expect(community?.officialEquivalenceCount).toBe(0);
  });

  it("groups by brand and range in catalog order and counts paints", () => {
    const draft = validDraft();
    insertSorted(
      draft.paints,
      draftPaint({
        id: "acme/core/pale-red",
        rangeId: "acme/core",
        color: {
          hex: "#ee8888",
          origin: "community",
          sourceId: "community-hex",
        },
      }),
      draftPaint({
        id: "acme/classic/old-blue",
        rangeId: "acme/classic",
        status: { kind: "discontinued", replacement: null },
        color: {
          hex: "#223388",
          origin: "community",
          sourceId: "community-hex",
        },
      }),
    );

    const community = sourceContributions(catalogOf(draft))[1];

    expect(community?.colors.map((c) => c.brand.id)).toEqual([
      "acme",
      "globex",
    ]);
    expect(community?.colors[0]?.ranges.map((r) => r.id)).toEqual([
      "acme/classic",
      "acme/core",
    ]);
    expect(community?.colors[0]?.paintCount).toBe(2);
  });

  it("keeps a source that backs nothing", () => {
    const draft = validDraft();
    draft.sources.push({
      id: "unused",
      kind: "third-party",
      title: "Unused",
      publisher: "Nobody",
      url: null,
      archiveUrl: null,
      retrievedAt: "2026-10-31",
      license: "unknown",
      attribution: null,
    });

    const unused = sourceContributions(catalogOf(draft)).at(-1);

    expect(unused?.source.id).toBe("unused");
    expect(unused?.colors).toEqual([]);
    expect(unused?.replacementCount).toBe(0);
  });

  it("is frozen", () => {
    const result = sourceContributions(catalogOf(validDraft()));
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result[0])).toBe(true);
    expect(Object.isFrozen(result[0]?.colors)).toBe(true);
  });
});
