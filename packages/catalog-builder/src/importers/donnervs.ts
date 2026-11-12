/**
 * Importer for the DonnervS/miniature-paints per-brand JSON files. Their hex
 * values are sampled from product images, so the origin is `community`
 * (ADR-0014). Pure: receives the file already read.
 */
import { err, ok, type PaintType, type Result } from "@rueda-cromatica/domain";
import { z } from "zod";
import { normalizeHex } from "./color.ts";
import type { ImportedPaint } from "./merge.ts";

/** Where the paints of one DonnervS `set` go; `null` leaves the set out. */
export type DonnervSLine = {
  readonly rangeId: string;
  readonly type: PaintType;
  /** Whole set metallic; otherwise only the names in `metallics`. */
  readonly metallic: boolean;
} | null;

export interface DonnervSBrand {
  /** Path of the brand file inside the repository. */
  readonly file: string;
  /** Every set of the file, so a new one makes the import fail. */
  readonly lines: Readonly<Record<string, DonnervSLine>>;
  /** Metallic paints inside sets that are not metallic as a whole. */
  readonly metallics: ReadonlySet<string>;
  /** Products without colour or outside the catalogue (ADR-0013). */
  readonly excluded: ReadonlySet<string>;
  /** Names misspelt in the file, proved by a manufacturer page. */
  readonly nameErrata: Readonly<Record<string, string>>;
}

/** The Army Painter: the MVP lines are Warpaints Fanatic and Speedpaint 2.0. */
const THE_ARMY_PAINTER: DonnervSBrand = {
  file: "paints/json/Army_Painter.json",
  lines: {
    "Warpaints Fanatic": {
      rangeId: "the-army-painter/warpaints-fanatic",
      type: "standard",
      metallic: false,
    },
    "Warpaints Fanatic Wash": {
      rangeId: "the-army-painter/warpaints-fanatic",
      type: "wash",
      metallic: false,
    },
    "Warpaints Fanatic Metallic": {
      rangeId: "the-army-painter/warpaints-fanatic",
      type: "standard",
      metallic: true,
    },
    "Warpaints Fanatic Effects": {
      rangeId: "the-army-painter/warpaints-fanatic",
      type: "technical",
      metallic: false,
    },
    // Codes WP20xx: Speedpaint 2.0.
    Speedpaint: {
      rangeId: "the-army-painter/speedpaint-2-0",
      type: "contrast",
      metallic: false,
    },
    "Warpaints Air": null,
    "John Blanche": null,
    "Speedpaint Marker": null,
  },
  // Sold as "Speedpaint, <name>" next to the Speedpaint Metallics Set 2.0.
  metallics: new Set(["Brazen Copper", "Enchanted Steel", "Polished Silver"]),
  excluded: new Set([
    "Gloss Varnish",
    "Matt Varnish",
    "Warpaints Retarder",
    "Warpaints Stabilizer",
    "Wash Medium",
    "Brush-On Primer",
    "Medium",
  ]),
  nameErrata: {
    // https://thearmypainter.com/products/warpaints-fanatic-warpaints-fanatic-bony-spikes-wp3089p
    "Boney Spikes": "Bony Spikes",
    // https://thearmypainter.com/products/warpaints-fanatic-warpaints-fanatic-tiger-s-eye-skin-wp3152p
    "Tiger's Eye": "Tiger's Eye Skin",
  },
};

export const DONNERVS_BRANDS: Readonly<Record<string, DonnervSBrand>> = {
  "the-army-painter": THE_ARMY_PAINTER,
};

const fileSchema = z.object({
  paints: z.array(
    z.object({
      name: z.string(),
      code: z.string().nullable(),
      set: z.string(),
      hex: z.string().nullable(),
      colourless: z.boolean(),
      measuredHex: z.string().nullable(),
    }),
  ),
});

export function importDonnervS(
  content: unknown,
  brand: DonnervSBrand,
  sourceId: string,
): Result<readonly ImportedPaint[], readonly string[]> {
  const parsed = fileSchema.safeParse(content);
  if (!parsed.success) {
    return err(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    );
  }

  const paints: ImportedPaint[] = [];
  const issues: string[] = [];
  for (const row of parsed.data.paints) {
    const at = `${row.set} / ${row.name}`;
    if (!Object.hasOwn(brand.lines, row.set)) {
      issues.push(`${at}: unknown set "${row.set}"`);
      continue;
    }
    const line = brand.lines[row.set];
    if (line === null || line === undefined || brand.excluded.has(row.name)) {
      continue;
    }
    if (row.colourless) {
      issues.push(`${at}: colourless but not excluded`);
      continue;
    }
    // A colorimeter reading would be a second colour source (ADR-0019).
    if (row.measuredHex !== null) {
      issues.push(`${at}: has a measured colour, not handled yet`);
      continue;
    }
    const hex = row.hex === null ? null : normalizeHex(row.hex);
    if (hex === null) {
      issues.push(`${at}: invalid hex ${String(row.hex)}`);
      continue;
    }
    paints.push({
      rangeId: line.rangeId,
      name: brand.nameErrata[row.name] ?? row.name,
      manufacturerCode: row.code,
      type: line.type,
      metallic: line.metallic || brand.metallics.has(row.name),
      color: { hex, origin: "community", sourceId },
    });
  }
  return issues.length > 0 ? err(issues) : ok(paints);
}
