/**
 * Importer for the DonnervS/miniature-paints per-brand JSON files. Their hex
 * values are sampled from product images; some rows add a colorimeter
 * reading (docs/04 §7). Pure: receives the files already read.
 */
import { err, ok, type Result } from "@chromatic-wheel/domain";
import { z } from "zod";
import type { SourceRow } from "../model/curated.ts";
import type { ProposalRules } from "./reconcile.ts";

/** The files of the repository that are transcribed, one per brand. */
export const DONNERVS_FILES = [
  "paints/json/AK.json",
  "paints/json/Army_Painter.json",
  "paints/json/Vallejo.json",
] as const;

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

/**
 * Transcribes every row of the files, literally, in their order. The key is
 * the manufacturer code, which every row has and none repeats.
 */
export function transcribeDonnervS(
  files: readonly { readonly name: string; readonly content: unknown }[],
): Result<readonly SourceRow[], readonly string[]> {
  const rows: SourceRow[] = [];
  const issues: string[] = [];
  for (const file of files) {
    const parsed = fileSchema.safeParse(file.content);
    if (!parsed.success) {
      issues.push(
        ...parsed.error.issues.map(
          (i) => `${file.name} ${i.path.join(".")}: ${i.message}`,
        ),
      );
      continue;
    }
    for (const row of parsed.data.paints) {
      if (row.code === null) {
        issues.push(`${file.name} ${row.set} / ${row.name}: no code`);
        continue;
      }
      rows.push({
        key: row.code,
        group: row.set,
        name: row.name,
        code: row.code,
        hex: row.hex,
        gradient: null,
        measuredHex: row.measuredHex,
        finish: null,
        colourless: row.colourless,
      });
    }
  }
  return issues.length > 0 ? err(issues) : ok(rows);
}

/** Whether `AK11205`-style codes fall in any of the numeric ranges. */
const codeIn =
  (...ranges: readonly (readonly [number, number])[]) =>
  (code: string): boolean => {
    const n = Number(code.replace(/\D/g, ""));
    return ranges.some(([from, to]) => n >= from && n <= to);
  };

/**
 * How a new row becomes a proposed paint. Every classification follows the
 * manufacturer's site or charts (ADR-0013); a paint whose type differs from
 * its group's is corrected in its curated file, with a note.
 */
export const DONNERVS_RULES: ProposalRules = {
  groups: {
    // The Army Painter. Codes WP20xx: Speedpaint 2.0.
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
    Speedpaint: {
      rangeId: "the-army-painter/speedpaint-2-0",
      type: "contrast",
      metallic: false,
    },
    // AK Interactive. All the 3Gen labels form a single range.
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
    // Vallejo: charts CC329 (Model Color) and CC266 (Game Color, Xpress).
    "Model Color": {
      rangeId: "vallejo/model-color",
      type: "standard",
      metallic: false,
    },
    "Game Color": {
      rangeId: "vallejo/game-color",
      type: "standard",
      metallic: false,
    },
    "Game Color Wash": {
      rangeId: "vallejo/game-color",
      type: "wash",
      metallic: false,
    },
    "Game Color Special FX": {
      rangeId: "vallejo/game-color",
      type: "technical",
      metallic: false,
    },
    "Xpress Color": {
      rangeId: "vallejo/xpress-color",
      type: "contrast",
      metallic: false,
    },
    "Xpress Color Intense": {
      rangeId: "vallejo/xpress-color",
      type: "contrast",
      metallic: false,
    },
  },
  // AK prints apart from the name what DonnervS adds to it: the label of
  // 3Gen ("AFV Olive Drab Base" is "Olive Drab Base") and the intensity of
  // Quick Gen ("Bile Yellow Medium" is "Bile Yellow").
  name: (row) => {
    const { code } = row;
    if (code === null || !code.startsWith("AK")) return row.name;
    return codeIn([17001, 17079])(code)
      ? row.name.replace(/ (?:Low|Medium|High)$/, "")
      : row.name.replace(/^(?:AFV|FIG) /, "");
  },
};
