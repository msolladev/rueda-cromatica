import { describe, expect, it } from "vitest";
import {
  ID_COLLECTIONS,
  tombstonesFileSchema,
  type IdCollection,
  type Tombstones,
} from "../model/curated.ts";
import { curated } from "../fixtures.ts";
import { buildCatalog } from "./build-catalog.ts";
import {
  catalogIds,
  checkIdStability,
  formatStabilityIssues,
  latestRelease,
  nextRelease,
  type CatalogIds,
} from "./id-stability.ts";

// The fictitious IDs of the fixtures, plus one more per collection that the
// published catalog had and the curated data no longer has.
const RETIRED: Readonly<Record<IdCollection, string>> = {
  sources: "acme-old-chart",
  brands: "initech",
  ranges: "acme/legacy",
  paints: "acme/core/purple",
};

/** The IDs of the catalog built from the fixtures. */
function current(): CatalogIds {
  const built = buildCatalog(curated());
  if (!built.ok) throw new Error(JSON.stringify(built.error));
  const ids = catalogIds(built.value.document);
  if (!ids.ok) throw new Error(ids.error);
  return ids.value;
}

const withId = (
  ids: CatalogIds,
  collection: IdCollection,
  id: string,
): CatalogIds => ({ ...ids, [collection]: new Set([...ids[collection], id]) });

const noTombstones: Tombstones = {
  sources: [],
  brands: [],
  ranges: [],
  paints: [],
};

const tombstoned = (collection: IdCollection, id: string): Tombstones =>
  tombstonesFileSchema.parse({
    ...noTombstones,
    [collection]: [
      collection === "paints"
        ? { id, reason: "Registered twice.", remainingPaintId: null }
        : { id, reason: "Registered twice." },
    ],
  });

describe("checkIdStability (docs/03 §7)", () => {
  describe.each(ID_COLLECTIONS)("%s", (collection) => {
    const id = RETIRED[collection];
    const published = {
      label: "release/2026-12-01",
      ids: withId(current(), collection, id),
    };

    it("fails when a published ID disappears without a tombstone", () => {
      expect(
        checkIdStability({
          current: current(),
          tombstones: noTombstones,
          published,
          disabledSources: new Set(),
        }),
      ).toEqual([{ kind: "missing", collection, id }]);
    });

    it("passes when the ID that disappears is tombstoned", () => {
      expect(
        checkIdStability({
          current: current(),
          tombstones: tombstoned(collection, id),
          published,
          disabledSources: new Set(),
        }),
      ).toEqual([]);
    });

    it("fails when a tombstoned ID appears again", () => {
      expect(
        checkIdStability({
          current: withId(current(), collection, id),
          tombstones: tombstoned(collection, id),
          published,
          disabledSources: new Set(),
        }),
      ).toEqual([{ kind: "reused", collection, id }]);
    });
  });

  it("passes when nothing changed since the release", () => {
    const ids = current();
    expect(
      checkIdStability({
        current: ids,
        tombstones: noTombstones,
        published: { label: "release/2026-12-01", ids },
        disabledSources: new Set(),
      }),
    ).toEqual([]);
  });

  it("does not compare with a release before the first one", () => {
    expect(
      checkIdStability({
        current: current(),
        tombstones: noTombstones,
        published: null,
        disabledSources: new Set(),
      }),
    ).toEqual([]);
  });

  it("checks the tombstones even before the first release", () => {
    expect(
      checkIdStability({
        current: current(),
        tombstones: tombstoned("paints", "acme/core/red"),
        published: null,
        disabledSources: new Set(),
      }),
    ).toEqual([{ kind: "reused", collection: "paints", id: "acme/core/red" }]);
  });

  it("accepts a published source that is disabled, and only a source (ADR-0019, 5)", () => {
    const published = {
      label: "release/2026-12-01",
      ids: withId(withId(current(), "sources", "initech"), "brands", "initech"),
    };
    expect(
      checkIdStability({
        current: current(),
        tombstones: noTombstones,
        published,
        disabledSources: new Set(["initech"]),
      }),
    ).toEqual([{ kind: "missing", collection: "brands", id: "initech" }]);
  });

  it("fails when the paint a tombstone says remains is not in the catalog", () => {
    const tombstones = (remainingPaintId: string): Tombstones =>
      tombstonesFileSchema.parse({
        ...noTombstones,
        paints: [
          { id: RETIRED.paints, reason: "Duplicate.", remainingPaintId },
        ],
      });
    const check = (remainingPaintId: string) =>
      checkIdStability({
        current: current(),
        tombstones: tombstones(remainingPaintId),
        published: null,
        disabledSources: new Set(),
      });
    expect(check("acme/core/red")).toEqual([]);
    expect(check("acme/core/teal")).toEqual([
      {
        kind: "remaining-missing",
        collection: "paints",
        id: RETIRED.paints,
        remainingPaintId: "acme/core/teal",
      },
    ]);
  });

  it("does not mix up collections that share a slug", () => {
    // A brand tombstone does not block a source with the same slug.
    expect(
      checkIdStability({
        current: withId(current(), "sources", "initech"),
        tombstones: tombstoned("brands", "initech"),
        published: null,
        disabledSources: new Set(),
      }),
    ).toEqual([]);
  });
});

describe("formatStabilityIssues", () => {
  it("says how to fix each issue, with the tombstone to paste", () => {
    const report = formatStabilityIssues(
      [
        { kind: "missing", collection: "paints", id: "acme/core/purple" },
        { kind: "reused", collection: "brands", id: "initech" },
      ],
      {
        published: "release/2026-12-01",
        tombstonesFile: "packages/catalog-builder/data/tombstones.json",
      },
    );
    expect(report).toBe(
      [
        "ID stability against release/2026-12-01:",
        "  paints acme/core/purple: published but missing.",
        "    A published ID is never deleted. If the product is no longer sold, restore it",
        '    with status "discontinued". If it was a registration error, add it to',
        "    packages/catalog-builder/data/tombstones.json with its reason (docs/03 §6):",
        '      "paints": [{ "id": "acme/core/purple", "reason": "…", "remainingPaintId": null }]',
        "  brands initech: tombstoned, and a tombstoned ID is never reused.",
        "    Choose another ID (docs/03 §3).",
      ].join("\n"),
    );
  });

  it("says when nothing is published yet", () => {
    const report = formatStabilityIssues(
      [{ kind: "reused", collection: "brands", id: "initech" }],
      { published: null, tombstonesFile: "tombstones.json" },
    );
    expect(report.split("\n")[0]).toBe(
      "ID stability (nothing published yet, only the tombstones are checked):",
    );
  });

  it("says which remaining paint is missing", () => {
    const report = formatStabilityIssues(
      [
        {
          kind: "remaining-missing",
          collection: "paints",
          id: "acme/core/purple",
          remainingPaintId: "acme/core/teal",
        },
      ],
      { published: null, tombstonesFile: "tombstones.json" },
    );
    expect(report.split("\n").slice(1)).toEqual([
      "  paints acme/core/purple: its tombstone says acme/core/teal remains, but that paint",
      "    is not in the catalog. Name a paint of the catalog, or null.",
    ]);
  });
});

describe("latestRelease", () => {
  it("is null before the first release", () => {
    expect(latestRelease([])).toEqual({ ok: true, value: null });
  });

  it("picks the newest date and ignores other tags", () => {
    expect(
      latestRelease([
        "release/2026-12-01",
        "v1.0.0",
        "release/2027-01-15",
        "release/2026-12-20",
      ]),
    ).toEqual({ ok: true, value: "release/2027-01-15" });
  });

  it("orders the releases of a day by their sequence, not alphabetically", () => {
    expect(
      latestRelease([
        "release/2026-12-01.10",
        "release/2026-12-01",
        "release/2026-12-01.2",
        "release/2026-11-30.3",
      ]),
    ).toEqual({ ok: true, value: "release/2026-12-01.10" });
  });

  it("rejects release tags without a valid date or sequence", () => {
    const result = latestRelease([
      "release/2026-12-01",
      "release/latest",
      "release/2026-02-30",
      "release/2026-12-01.1",
      "release/2026-12-01.02",
    ]);
    const format = "release/YYYY-MM-DD or release/YYYY-MM-DD.N (N ≥ 2)";
    expect(result.ok ? [] : result.error).toEqual(
      [
        "release/latest",
        "release/2026-02-30",
        "release/2026-12-01.1",
        "release/2026-12-01.02",
      ].map(
        (tag) => `Tag ${tag} does not follow ${format}; rename or delete it.`,
      ),
    );
  });
});

describe("catalogIds", () => {
  it("reads only the IDs, whatever else a published catalog holds", () => {
    const result = catalogIds({
      meta: { schemaVersion: 99 },
      sources: [{ id: "acme-web", extra: true }],
      brands: [{ id: "acme" }],
      ranges: [],
      paints: [{ id: "acme/core/red" }],
    });
    expect(result).toEqual({
      ok: true,
      value: {
        sources: new Set(["acme-web"]),
        brands: new Set(["acme"]),
        ranges: new Set(),
        paints: new Set(["acme/core/red"]),
      },
    });
  });

  it("rejects a document without the four collections", () => {
    expect(catalogIds({ brands: [] }).ok).toBe(false);
  });
});

describe("nextRelease", () => {
  it("is the day's date for the first release, and before any", () => {
    expect(nextRelease([], "2026-12-01")).toEqual({
      ok: true,
      value: "release/2026-12-01",
    });
    expect(nextRelease(["release/2026-11-30.2"], "2026-12-01")).toEqual({
      ok: true,
      value: "release/2026-12-01",
    });
  });

  it("numbers the next releases of the same day", () => {
    expect(nextRelease(["release/2026-12-01"], "2026-12-01")).toEqual({
      ok: true,
      value: "release/2026-12-01.2",
    });
    expect(
      nextRelease(
        ["release/2026-12-01", "release/2026-12-01.9", "release/2026-12-01.2"],
        "2026-12-01",
      ),
    ).toEqual({ ok: true, value: "release/2026-12-01.10" });
  });

  it("fails on invalid tags and on a release later than today", () => {
    expect(nextRelease(["release/latest"], "2026-12-01").ok).toBe(false);
    expect(nextRelease(["release/2026-12-02"], "2026-12-01")).toEqual({
      ok: false,
      error: [
        "The latest release, release/2026-12-02, is later than 2026-12-01.",
      ],
    });
  });
});
