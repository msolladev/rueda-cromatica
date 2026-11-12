/**
 * Importer for the SimoGecko/CitadelColours official colours table: the
 * swatch colours of citadelcolour.com, collected by a third party, so their
 * origin is `community` (ADR-0014). Pure: receives the Markdown already read.
 */
import { err, ok, type PaintType, type Result } from "@rueda-cromatica/domain";
import { gradientMidpoint, normalizeHex } from "./color.ts";
import type { ImportedPaint } from "./merge.ts";

/** MVP lines (ADR-0019) by the table's `Type`; `null` lines are left out. */
const LINES: Readonly<
  Record<string, { readonly rangeId: string; readonly type: PaintType } | null>
> = {
  base: { rangeId: "citadel/base", type: "base" },
  layer: { rangeId: "citadel/layer", type: "layer" },
  shade: { rangeId: "citadel/shade", type: "wash" },
  contrast: { rangeId: "citadel/contrast", type: "contrast" },
  technical: { rangeId: "citadel/technical", type: "technical" },
  dry: { rangeId: "citadel/dry", type: "dry" },
  spray: null,
  air: null,
};

/** `medium` covers products without colour (varnishes, mediums, thinners). */
const FINISHES = new Set(["", "metal", "medium", "gloss", "texture"]);

const COLOR_CELL = /^`(#[0-9a-f]{6})(?:_(#[0-9a-f]{6}))?`$/i;

export function importSimoGecko(
  markdown: string,
  sourceId: string,
): Result<readonly ImportedPaint[], readonly string[]> {
  const paints: ImportedPaint[] = [];
  const issues: string[] = [];

  markdown.split("\n").forEach((line, i) => {
    const cells = tableCells(line);
    // Data rows are the ones whose colour cell is code-formatted.
    if (cells?.[3]?.startsWith("`") !== true) return;
    const [name = "", typeCell = "", finish = "", colorCell = ""] = cells;
    const at = `line ${String(i + 1)}`;

    if (!Object.hasOwn(LINES, typeCell)) {
      issues.push(`${at}: unknown type "${typeCell}"`);
      return;
    }
    if (!FINISHES.has(finish)) {
      issues.push(`${at}: unknown finish "${finish}"`);
      return;
    }
    const target = LINES[typeCell];
    if (target === null || target === undefined || finish === "medium") return;

    const hex = colorOf(colorCell);
    if (hex === null || name === "") {
      issues.push(`${at}: unreadable row "${line.trim()}"`);
      return;
    }
    paints.push({
      rangeId: target.rangeId,
      name,
      manufacturerCode: null,
      type: target.type,
      metallic: finish === "metal",
      color: { hex, origin: "community", sourceId },
    });
  });

  return issues.length > 0 ? err(issues) : ok(paints);
}

function tableCells(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null;
  return trimmed
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

/** A single hex, or the midpoint of a `dark_light` gradient. */
function colorOf(cell: string): string | null {
  const match = COLOR_CELL.exec(cell);
  if (match === null) return null;
  const [, first = "", second] = match;
  return second === undefined
    ? normalizeHex(first)
    : gradientMidpoint(first, second);
}
