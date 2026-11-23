/**
 * Importer for the Arcturus5404/miniature-paints Markdown tables, the source
 * of the hex values of the original Warpaints, which no other source has
 * (docs/04 §7). Its data was scraped from the web, without saying from
 * where. Pure: receives the file already read.
 */
import { err, ok, type Result } from "@chromatic-wheel/domain";
import type { SourceRow } from "../curated/files.ts";
import type { ProposalRules } from "./reconcile.ts";

const HEADER = ["Name", "Code", "Set", "R", "G", "B", "Hex"];
const HEX = /`(#[0-9A-Fa-f]{6})`/;

/**
 * Transcribes every row of a table, literally, in its order. Many rows have
 * no code and a name can be in several sets, so the key is the set and the
 * name. The RGB columns repeat the hex and are not transcribed.
 */
export function transcribeArcturus(
  markdown: string,
): Result<readonly SourceRow[], readonly string[]> {
  const rows: SourceRow[] = [];
  const issues: string[] = [];
  const keys = new Set<string>();
  const lines = markdown.split("\n").filter((line) => line.startsWith("|"));
  const [header, separator, ...body] = lines.map((line) =>
    line.split("|").slice(1, -1),
  );
  if (header?.join("|") !== HEADER.join("|")) {
    return err([`Unexpected header: ${lines[0] ?? "(none)"}`]);
  }
  if (separator?.some((cell) => !/^-+$/.test(cell)) !== false) {
    return err([`Unexpected separator: ${lines[1] ?? "(none)"}`]);
  }
  for (const [i, cells] of body.entries()) {
    const [name, code, set, , , , hexCell] = cells;
    const hex = hexCell === undefined ? undefined : HEX.exec(hexCell)?.[1];
    if (
      cells.length !== HEADER.length ||
      name === undefined ||
      hex === undefined
    ) {
      issues.push(`Row ${String(i + 1)}: unexpected cells: ${cells.join("|")}`);
      continue;
    }
    const key = `${set ?? ""}/${name}`;
    if (keys.has(key)) {
      issues.push(`Row ${String(i + 1)}: "${key}" is repeated`);
      continue;
    }
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
  return issues.length > 0 ? err(issues) : ok(rows);
}

const WARPAINTS = "the-army-painter/warpaints";

/**
 * How a new row becomes a proposed paint. Only the original Warpaints come
 * from this source; every other group is ignored in its file. The types
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
