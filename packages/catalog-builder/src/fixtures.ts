/**
 * Fictitious curated files for tests. Brands, paints, codes and colours are
 * invented.
 */
import type { RawFile } from "./curated/files.ts";

export function sourcesFile(): RawFile {
  return {
    name: "sources.json",
    content: [
      {
        id: "acme-web",
        kind: "manufacturer",
        title: "Acme paint list",
        publisher: "Acme Paints",
        url: "https://example.com/acme",
        archiveUrl: null,
        retrievedAt: "2026-11-12",
        license: "terms-of-use",
        attribution: null,
      },
    ],
  };
}

interface DraftPaint {
  id: string;
  rangeId: string;
  name: string;
  hex: string | null;
}

const paint = ({ id, rangeId, name, hex }: DraftPaint) => ({
  id,
  rangeId,
  name,
  aliases: [],
  manufacturerCode: null,
  type: "standard",
  metallic: false,
  color:
    hex === null ? null : { hex, origin: "manufacturer", sourceId: "acme-web" },
  status: { kind: "active" },
});

export function acmeFile(): RawFile & { content: AcmeContent } {
  return {
    name: "acme.json",
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
        paint({
          id: "acme/core/red",
          rangeId: "acme/core",
          name: "Red",
          hex: "#aa0000",
        }),
        paint({
          id: "acme/core/blue",
          rangeId: "acme/core",
          name: "Blue",
          hex: "#0000aa",
        }),
      ],
    },
  };
}

/** Replaces fields of one paint of a fixture file. */
export function patchPaint(
  file: { content: AcmeContent },
  index: number,
  patch: Partial<ReturnType<typeof paint>>,
): void {
  const current = file.content.paints[index];
  if (current === undefined) throw new Error(`No paint ${String(index)}`);
  file.content.paints[index] = { ...current, ...patch };
}

export function globexFile(): RawFile & { content: AcmeContent } {
  return {
    name: "globex.json",
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
      paints: [
        paint({
          id: "globex/standard/green",
          rangeId: "globex/standard",
          name: "Green",
          hex: null,
        }),
      ],
    },
  };
}

interface AcmeContent {
  brand: { id: string; name: string; aliases: string[] };
  ranges: { id: string; brandId: string; name: string; status: string }[];
  paints: ReturnType<typeof paint>[];
}
