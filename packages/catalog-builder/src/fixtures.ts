/**
 * Fictitious curated files for tests. Brands, sources, paints, codes and
 * colours are invented.
 */
import {
  readCurated,
  type Curated,
  type CuratedData,
  type RawFile,
} from "./curated/files.ts";

export interface Row {
  key: string;
  group: string;
  name: string;
  code: string | null;
  hex: string | null;
  gradient: { dark: string; light: string } | null;
  measuredHex: string | null;
  finish: string | null;
  colourless: boolean;
}

export const row = (patch: Partial<Row> & Pick<Row, "key">): Row => ({
  group: "Core",
  name: patch.key,
  code: patch.key,
  hex: "#000000",
  gradient: null,
  measuredHex: null,
  finish: null,
  colourless: false,
  ...patch,
});

interface Ignore {
  reasonId: string;
  note: string | null;
}

export interface SourceContent {
  source: {
    id: string;
    kind: string;
    title: string;
    publisher: string;
    url: string | null;
    archiveUrl: string | null;
    retrievedAt: string;
    license: string;
    attribution: string | null;
  };
  disabled: { note: string } | null;
  files: { url: string; name: string; sha256: string }[];
  paints: Row[];
  equivalences: { from: string; to: string; note: string | null }[];
  replacements: { from: string; to: string; note: string | null }[];
  ignoredGroups: (Ignore & { group: string })[];
  ignoredKeys: (Ignore & { key: string })[];
}

/** The Acme chart: a row per paint, plus a varnish and an airbrush line. */
export function acmeSource(): RawFile & { content: SourceContent } {
  return {
    name: "sources/acme-chart.json",
    content: {
      source: {
        id: "acme-chart",
        kind: "manufacturer",
        title: "Acme paint chart",
        publisher: "Acme Paints",
        url: "https://example.com/acme",
        archiveUrl: null,
        retrievedAt: "2026-11-12",
        license: "terms-of-use",
        attribution: null,
      },
      disabled: null,
      files: [],
      paints: [
        row({ key: "AC-01", name: "Red", hex: "#AA0000" }),
        row({ key: "AC-02", name: "Blue", hex: "#0000aa" }),
        row({
          key: "AC-03",
          name: "Gloss Varnish",
          hex: null,
          colourless: true,
        }),
        row({ key: "AC-90", name: "Air Red", group: "Air" }),
        row({ key: "GX-01", name: "Green", group: "Globex", hex: null }),
      ],
      equivalences: [],
      replacements: [],
      ignoredGroups: [{ group: "Air", reasonId: "airbrush", note: null }],
      ignoredKeys: [{ key: "AC-03", reasonId: "auxiliary", note: null }],
    },
  };
}

export interface PaintContent {
  id: string;
  rangeId: string;
  name: string;
  aliases: string[];
  manufacturerCode: string | null;
  type: string;
  metallic: boolean;
  status:
    | { kind: "active" }
    | {
        kind: "discontinued";
        replacementChoice: { sourceId: string; note: string } | null;
      };
  keys: { sourceId: string; key: string }[];
  colorChoice: {
    sourceId: string;
    origin: string;
    hex: string;
    note: string;
  } | null;
  rejectedColors: {
    sourceId: string;
    origin: string;
    hex: string;
    reasonId: string;
    note: string | null;
  }[];
  note: string | null;
}

export interface BrandContent {
  brand: { id: string; name: string; aliases: string[] };
  ranges: { id: string; brandId: string; name: string; status: string }[];
  paints: PaintContent[];
}

const paint = (id: string, name: string, key: string): PaintContent => ({
  id,
  rangeId: id.split("/").slice(0, 2).join("/"),
  name,
  aliases: [],
  manufacturerCode: key,
  type: "standard",
  metallic: false,
  status: { kind: "active" },
  keys: [{ sourceId: "acme-chart", key }],
  colorChoice: null,
  rejectedColors: [],
  note: null,
});

export function acmeFile(): RawFile & { content: BrandContent } {
  return {
    name: "brands/acme.json",
    content: {
      brand: { id: "acme", name: "Acme Paints", aliases: [] },
      ranges: [
        {
          id: "acme/core",
          brandId: "acme",
          name: "Acme Core",
          status: "active",
        },
      ],
      // Deliberately unsorted: the builder sorts.
      paints: [
        paint("acme/core/red", "Red", "AC-01"),
        paint("acme/core/blue", "Blue", "AC-02"),
      ],
    },
  };
}

export function globexFile(): RawFile & { content: BrandContent } {
  return {
    name: "brands/globex.json",
    content: {
      brand: { id: "globex", name: "Globex Colours", aliases: [] },
      ranges: [
        {
          id: "globex/standard",
          brandId: "globex",
          name: "Globex Standard",
          status: "active",
        },
      ],
      paints: [paint("globex/standard/green", "Green", "GX-01")],
    },
  };
}

/** Replaces fields of one paint of a fixture file. */
export function patchPaint(
  file: { content: BrandContent },
  index: number,
  patch: Partial<PaintContent>,
): void {
  const current = file.content.paints[index];
  if (current === undefined) throw new Error(`No paint ${String(index)}`);
  file.content.paints[index] = { ...current, ...patch };
}

export function reasonsFile(): RawFile & {
  content: { id: string; text: string }[];
} {
  return {
    name: "ignore-reasons.json",
    content: [
      { id: "airbrush", text: "Airbrush line, out of scope." },
      { id: "auxiliary", text: "Product without colour." },
    ],
  };
}

export function policyFile(): RawFile & {
  content: Record<"measured" | "manufacturer" | "community", string[]>;
} {
  return {
    name: "color-policy.json",
    content: { measured: [], manufacturer: ["acme-chart"], community: [] },
  };
}

/** The fictitious curated data, editable by each test. */
export interface Fixtures extends CuratedData {
  sources: ReturnType<typeof acmeSource>[];
  brands: ReturnType<typeof acmeFile>[];
  ignoreReasons: ReturnType<typeof reasonsFile>;
  colorPolicy: ReturnType<typeof policyFile>;
}

/** The whole fictitious curated data, ready for the builder. */
export function curatedData(): Fixtures {
  return {
    sources: [acmeSource()],
    brands: [acmeFile(), globexFile()],
    ignoreReasons: reasonsFile(),
    colorPolicy: policyFile(),
  };
}

/** The fictitious curated data, validated; fails the test if it is not. */
export function curated(data: Fixtures = curatedData()): Curated {
  return valid(readCurated(data));
}

/** The value of a result; fails the test if it is an error. */
export function valid<T>(
  result: { ok: true; value: T } | { ok: false; error: unknown },
): T {
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}
