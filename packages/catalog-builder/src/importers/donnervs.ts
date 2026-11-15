/**
 * Importer for the DonnervS/miniature-paints per-brand JSON files. Their hex
 * values are sampled from product images, so the origin is `community`
 * (ADR-0014). Pure: receives the file already read.
 *
 * Paints are told apart by manufacturer code, since a range can repeat a
 * name (AK). Every classification below follows the manufacturer's site.
 */
import { err, ok, type PaintType, type Result } from "@rueda-cromatica/domain";
import { z } from "zod";
import { normalizeHex } from "./color.ts";
import type { ImportedPaint } from "./merge.ts";

/** Where the paints of one DonnervS `set` go; `null` leaves the set out. */
export type DonnervSLine = {
  readonly rangeId: string;
  readonly type: PaintType;
  readonly metallic: boolean;
} | null;

/** Type or metallic of a paint when they differ from its line's. */
export interface PaintOverride {
  readonly type?: PaintType;
  readonly metallic?: boolean;
}

export interface DonnervSBrand {
  /** Path of the brand file inside the repository. */
  readonly file: string;
  /** Every set of the file, so a new one makes the import fail. */
  readonly lines: Readonly<Record<string, DonnervSLine>>;
  /** Codes left out of the catalogue (ADR-0013, CLAUDE.md scope). */
  readonly excluded: (code: string) => boolean;
  readonly override: (code: string) => PaintOverride | undefined;
  /** Removes what DonnervS adds to the official names. */
  readonly cleanName?: (name: string, code: string) => string;
  /** Official names, by code, where DonnervS misspells them. */
  readonly nameErrata: Readonly<Record<string, string>>;
  /** Slugs chosen by hand, by code, where the proposed one collides. */
  readonly slugs: Readonly<Record<string, string>>;
  /** Codes whose measured colour is ignored in favour of the photo one. */
  readonly photoOverMeasured: ReadonlySet<string>;
}

/** Whether `AK11205`-style codes fall in any of the numeric ranges. */
const codeIn =
  (...ranges: readonly (readonly [number, number])[]) =>
  (code: string): boolean => {
    const n = Number(code.replace(/\D/g, ""));
    return ranges.some(([from, to]) => n >= from && n <= to);
  };

/** The Army Painter: Warpaints Fanatic and Speedpaint 2.0. */
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
  excluded: (code) =>
    [
      "WP3171P", // Warpaints Stabilizer
      "WP3172P", // Warpaints Retarder
      "WP3173P", // Gloss Varnish
      "WP3174P", // Matt Varnish
      "WP3175P", // Brush-On Primer
      "WP3216P", // Wash Medium
      "WP2000P", // Speedpaint Medium
      "WP2090P", // Speedpaint Medium 100 ml
    ].includes(code),
  // Brazen Copper, Enchanted Steel and Polished Silver: the store sells them
  // next to the Speedpaint Metallics Set 2.0.
  override: (code) =>
    codeIn([2071, 2073])(code) ? { metallic: true } : undefined,
  nameErrata: {
    // https://thearmypainter.com/products/warpaints-fanatic-warpaints-fanatic-bony-spikes-wp3089p
    WP3089P: "Bony Spikes",
    // https://thearmypainter.com/products/warpaints-fanatic-warpaints-fanatic-tiger-s-eye-skin-wp3152p
    WP3152P: "Tiger's Eye Skin",
  },
  slugs: {},
  photoOverMeasured: new Set(),
};

/**
 * AK Interactive: 3Gen Acrylics and Quick Gen. AK labels each 3Gen paint
 * (STANDARD, INTENSE, AFV, FIGURES…); all of them share the AK11xxx numbering
 * and form a single range, like Warpaints Fanatic. Source of the labels:
 * https://ak-interactive.com/wp-json/wc/store/v1/products?category=153207
 */
const AK_INTERACTIVE: DonnervSBrand = {
  file: "paints/json/AK.json",
  lines: {
    "3rd Gen Acrylics": {
      rangeId: "ak-interactive/3gen-acrylics",
      type: "standard",
      metallic: false,
    },
    "Quick Gen": {
      rangeId: "ak-interactive/quick-gen",
      type: "contrast",
      metallic: false,
    },
    "Artist Dense Acrylic": null,
    "Metallic Liquid Markers": null,
    Pigments: null,
    Playmarkers: null,
    "Real Colors": null,
    "Real Colors Markers": null,
    "Sprays & Primers": null,
    "Super Chrome": null,
    "The Inks": null,
    "True Metal": null,
    "Weathering Products": null,
    "XTREME Metal": null,
  },
  // AUXILIARY (retarder and mediums) and AIR (airbrush versions).
  excluded: codeIn([11231, 11235], [11801, 11920]),
  override: (code) => {
    // 3Gen METALLIC, and the Quick Gen paints of AK17522 Metallics Set.
    if (codeIn([11191, 11212], [17065, 17070])(code)) return { metallic: true };
    if (codeIn([11260, 11263])(code)) return { type: "technical" }; // effects
    return undefined;
  },
  // "AFV Olive Drab Base" is "Olive Drab Base" on AK's site, and "Bile
  // Yellow Medium" is "Bile Yellow": the label prints the Quick Gen intensity
  // (Low, Medium, High) apart from the name.
  cleanName: (name, code) =>
    codeIn([17001, 17079])(code)
      ? name.replace(/ (?:Low|Medium|High)$/, "")
      : name.replace(/^(?:AFV|FIG) /, ""),
  nameErrata: {
    AK11012: "Sky Grey FS 36463",
    AK11277: "Russet Shadow",
    AK11370: "Russian Sand 7",
    AK11428: "Light Green Uniform",
  },
  // Same official name in the STANDARD and FIGURES labels.
  slugs: {
    AK11402: "light-flesh-figures",
    AK11410: "dark-green-figures",
    AK11411: "light-green-figures",
    AK11424: "grey-green-figures",
    AK11426: "grey-blue-figures",
  },
  // Vampiric Flesh: one sample read by two devices that disagree (#C2B193 and
  // #A59784). The photo colour stays until phase 5 handles several candidates.
  photoOverMeasured: new Set(["AK11057"]),
};

export const DONNERVS_BRANDS: Readonly<Record<string, DonnervSBrand>> = {
  "ak-interactive": AK_INTERACTIVE,
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
    if (line === null || line === undefined) continue;
    const { code } = row;
    if (code === null) {
      issues.push(`${at}: no manufacturer code`);
      continue;
    }
    if (brand.excluded(code)) continue;
    if (row.colourless) {
      issues.push(`${at}: colourless but not excluded`);
      continue;
    }
    // A colorimeter reading would be a second colour source (ADR-0019).
    if (row.measuredHex !== null && !brand.photoOverMeasured.has(code)) {
      issues.push(`${at}: has a measured colour, not handled yet`);
      continue;
    }
    const hex = row.hex === null ? null : normalizeHex(row.hex);
    if (hex === null) {
      issues.push(`${at}: invalid hex ${String(row.hex)}`);
      continue;
    }
    const override = brand.override(code);
    const slug = brand.slugs[code];
    paints.push({
      rangeId: line.rangeId,
      name:
        brand.nameErrata[code] ?? brand.cleanName?.(row.name, code) ?? row.name,
      manufacturerCode: code,
      type: override?.type ?? line.type,
      metallic: override?.metallic ?? line.metallic,
      color: { hex, origin: "community", sourceId },
      ...(slug === undefined ? {} : { slug }),
    });
  }
  return issues.length > 0 ? err(issues) : ok(paints);
}
