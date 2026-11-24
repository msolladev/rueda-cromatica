/**
 * Importer for the Arcturus5404/miniature-paints Markdown tables, the source
 * of the hex values of the original Warpaints and of the old Citadel lines,
 * which no other source has (docs/04 §7, ADR-0034, ADR-0035). Its data was
 * scraped from the web, without saying from where. Pure: receives the files
 * already read.
 */
import { err, ok, type Result } from "@chromatic-wheel/domain";
import type { SourceRow } from "../model/curated.ts";
import type { ProposalRules } from "./reconcile.ts";

/**
 * The files of the source, inside the folder of its commit: The Army Painter
 * for the original Warpaints, Citadel for its old lines.
 */
export const ARCTURUS_FILES = [
  "paints/Army_Painter.md",
  "paints/Citadel_Colour.md",
] as const;

/** The headers of its tables: The Army Painter has codes, Citadel does not. */
const HEADERS = [
  ["Name", "Code", "Set", "R", "G", "B", "Hex"],
  ["Name", "Set", "R", "G", "B", "Hex"],
] as const;
const HEX = /`(#[0-9A-Fa-f]{6})`/;

/**
 * Transcribes every row of the tables, literally, file after file and in
 * their order. Many rows have no code and a name can be in several sets, so
 * the key is the set and the name. A set and name already transcribed, which
 * the Citadel table has once with two hex values, takes its occurrence after
 * it (`Foundation (discontinued)/Kommando Khaki (2)`). The RGB columns repeat
 * the hex and are not transcribed.
 */
export function transcribeArcturus(
  markdowns: readonly string[],
): Result<readonly SourceRow[], readonly string[]> {
  const rows: SourceRow[] = [];
  const issues: string[] = [];
  const keys = new Set<string>();
  for (const [f, markdown] of markdowns.entries()) {
    const at = `File ${String(f + 1)}`;
    const lines = markdown.split("\n").filter((line) => line.startsWith("|"));
    const [header, separator, ...body] = lines.map((line) =>
      line.split("|").slice(1, -1),
    );
    const columns = HEADERS.find((h) => h.join("|") === header?.join("|"));
    if (columns === undefined) {
      issues.push(`${at}: unexpected header: ${lines[0] ?? "(none)"}`);
      continue;
    }
    if (separator?.some((cell) => !/^-+$/.test(cell)) !== false) {
      issues.push(`${at}: unexpected separator: ${lines[1] ?? "(none)"}`);
      continue;
    }
    const cell = (cells: readonly string[], column: string) => {
      const i: number = (columns as readonly string[]).indexOf(column);
      return i < 0 ? undefined : cells[i];
    };
    for (const [i, cells] of body.entries()) {
      const name = cell(cells, "Name");
      const set = cell(cells, "Set");
      const code = cell(cells, "Code");
      const hex = HEX.exec(cell(cells, "Hex") ?? "")?.[1];
      if (
        cells.length !== columns.length ||
        name === undefined ||
        hex === undefined
      ) {
        issues.push(
          `${at}, row ${String(i + 1)}: unexpected cells: ${cells.join("|")}`,
        );
        continue;
      }
      const literal = `${set ?? ""}/${name}`;
      let key = literal;
      for (let n = 2; keys.has(key); n++) key = `${literal} (${String(n)})`;
      keys.add(key);
      rows.push({
        key,
        group: set ?? "",
        name,
        code: code === "null" || code === undefined ? null : code,
        hex,
        gradient: null,
        measuredHex: null,
        finish: null,
        colourless: false,
      });
    }
  }
  return issues.length > 0 ? err(issues) : ok(rows);
}

const WARPAINTS = "the-army-painter/warpaints";

/**
 * How a new row becomes a proposed paint. Only the original Warpaints come
 * from this source; the old Citadel paints come from the documents of Games
 * Workshop (ADR-0035) and only take their colour from it, and every other
 * group is ignored in its file. The types
 * follow The Army Painter's classification (ADR-0013): acrylics, metallics,
 * Quickshade washes and effects. A paint whose type differs from its group's,
 * such as the metallics and effects of the «Warpaints» group, is corrected in
 * its curated file, with a note.
 */
export const ARCTURUS_RULES: ProposalRules = {
  groups: {
    Warpaints: { rangeId: WARPAINTS, type: "standard", metallic: false },
    "Warpaints Tone": { rangeId: WARPAINTS, type: "wash", metallic: false },
    "Skin Tones Paint Set": {
      rangeId: WARPAINTS,
      type: "standard",
      metallic: false,
    },
    "Skin Tones Paint Set - Washes": {
      rangeId: WARPAINTS,
      type: "wash",
      metallic: false,
    },
    "Metallic Colours Paint Set": {
      rangeId: WARPAINTS,
      type: "standard",
      metallic: true,
    },
  },
};
