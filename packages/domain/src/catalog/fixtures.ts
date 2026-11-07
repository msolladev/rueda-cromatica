/**
 * Fictitious catalog for tests, based on the docs/02 example. Brands, paints,
 * codes and colours are invented.
 */
import type { z } from "zod";
import { parseCatalog } from "./parse.ts";
import type { Catalog } from "./catalog.ts";
import {
  compareSortKeys,
  edgeSortKey,
  idSortKey,
  type CatalogIssue,
} from "./integrity.ts";
import {
  brandIdSchema,
  paintIdSchema,
  type BrandId,
  type catalogDocumentSchema,
  type PaintId,
} from "./schema.ts";

export const paintId = (id: string): PaintId => paintIdSchema.parse(id);
export const brandId = (id: string): BrandId => brandIdSchema.parse(id);

type DeepMutable<T> = T extends readonly (infer U)[]
  ? DeepMutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
    : T;

/** Raw, editable document: what `JSON.parse` would return. */
export type Draft = DeepMutable<z.input<typeof catalogDocumentSchema>>;
export type DraftPaint = Draft["paints"][number];

export function validDraft(): Draft {
  return {
    meta: { schemaVersion: 1, dataVersion: `sha256:${"0".repeat(64)}` },
    sources: [
      {
        id: "acme-conversion-chart",
        kind: "manufacturer",
        title: "Acme conversion chart",
        publisher: "Acme Paints",
        url: "https://example.com/acme-chart.pdf",
        archiveUrl: null,
        retrievedAt: "2026-10-31",
        license: "terms-of-use",
        attribution: null,
      },
      {
        id: "community-hex",
        kind: "third-party",
        title: "Community hex list",
        publisher: "Someone",
        url: null,
        archiveUrl: null,
        retrievedAt: "2026-10-31",
        license: "unknown",
        attribution: null,
      },
    ],
    brands: [
      { id: "acme", name: "Acme Paints", aliases: ["Acme"] },
      { id: "globex", name: "Globex Colours", aliases: [] },
    ],
    ranges: [
      {
        id: "acme/classic",
        brandId: "acme",
        name: "Acme Classic",
        status: "discontinued",
      },
      { id: "acme/core", brandId: "acme", name: "Acme Core", status: "active" },
      {
        id: "globex/standard",
        brandId: "globex",
        name: "Globex Standard",
        status: "active",
      },
    ],
    paints: [
      {
        id: "acme/classic/old-red",
        rangeId: "acme/classic",
        name: "Old Red",
        aliases: [],
        manufacturerCode: null,
        type: "base",
        metallic: false,
        color: null,
        status: {
          kind: "discontinued",
          replacement: {
            paintId: "acme/core/deep-red",
            sourceId: "acme-conversion-chart",
          },
        },
      },
      {
        id: "acme/core/deep-red",
        rangeId: "acme/core",
        name: "Deep Red",
        aliases: [],
        manufacturerCode: "AC-001",
        type: "base",
        metallic: false,
        color: {
          hex: "#8a1c1c",
          origin: "manufacturer",
          sourceId: "acme-conversion-chart",
        },
        status: { kind: "active" },
      },
      {
        id: "globex/standard/crimson",
        rangeId: "globex/standard",
        name: "Crimson",
        aliases: ["Old Crimson"],
        manufacturerCode: null,
        type: "standard",
        metallic: false,
        color: {
          hex: "#9b1b30",
          origin: "community",
          sourceId: "community-hex",
        },
        status: { kind: "active" },
      },
    ],
    equivalences: [
      {
        from: "acme/core/deep-red",
        to: "globex/standard/crimson",
        sourceId: "acme-conversion-chart",
      },
    ],
  };
}

/** A minimal paint to add to a draft; override what each test needs. */
export function draftPaint(
  overrides: Partial<DraftPaint> & Pick<DraftPaint, "id" | "rangeId">,
): DraftPaint {
  return {
    name: "Test Paint",
    aliases: [],
    manufacturerCode: null,
    type: "standard",
    metallic: false,
    color: null,
    status: { kind: "active" },
    ...overrides,
  };
}

export function find<T extends { id: string }>(items: T[], id: string): T {
  const item = items.find((candidate) => candidate.id === id);
  if (item === undefined) throw new Error(`Fixture has no item ${id}`);
  return item;
}

export function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined)
    throw new Error(`Fixture has no index ${String(index)}`);
  return item;
}

export function catalogOf(draft: Draft): Catalog {
  const result = parseCatalog(draft);
  if (!result.ok) {
    throw new Error(`Fixture is invalid: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

export function issuesOf(
  draft: unknown,
  kind: "invalid-structure" | "integrity",
): readonly CatalogIssue[] {
  const result = parseCatalog(draft);
  if (result.ok) throw new Error("Expected parseCatalog to fail");
  if (result.error.kind !== kind) {
    throw new Error(`Expected ${kind}, got ${JSON.stringify(result.error)}`);
  }
  return result.error.issues;
}

export const pathsOf = (issues: readonly CatalogIssue[]): string[] =>
  issues.map((issue) => issue.path);

/** Adds items keeping the collection sorted by ID, as the builder writes it. */
export function insertSorted<T extends { id: string }>(
  items: T[],
  ...added: T[]
): void {
  items.push(...added);
  items.sort((a, b) => compareSortKeys(idSortKey(a), idSortKey(b)));
}

type DraftEdge = Draft["equivalences"][number];

/** Adds equivalences keeping them sorted by (from, to, sourceId). */
export function insertEdges(edges: DraftEdge[], ...added: DraftEdge[]): void {
  edges.push(...added);
  edges.sort((a, b) => compareSortKeys(edgeSortKey(a), edgeSortKey(b)));
}
