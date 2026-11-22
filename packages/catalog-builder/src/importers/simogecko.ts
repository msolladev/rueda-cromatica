/**
 * Importers for the two tables of SimoGecko/CitadelColours (docs/04 §7): the
 * official one, with the swatch colours of citadelcolour.com, and the sampled
 * one, with colours averaged from photos of painted swatches. Pure: they
 * receive the Markdown already read.
 */
import { err, ok, type Result } from "@chromatic-wheel/domain";
import type { SourceRow } from "../curated/files.ts";
import type { ProposalRules } from "./reconcile.ts";

/** A hex, or a `dark_light` gradient, as the table writes them. */
const COLOR_CELL = /^`(#[0-9a-f]{6})(?:_(#[0-9a-f]{6}))?`$/i;

/**
 * Transcribes every row of the table, literally. The table has no codes and
 * repeats names across types (Abaddon Black is a `base` and a `spray`), so
 * the key is the type and the name: `base/Abaddon Black`.
 */
export function transcribeSimoGecko(
  markdown: string,
): Result<readonly SourceRow[], readonly string[]> {
  const rows: SourceRow[] = [];
  const issues: string[] = [];

  markdown.split("\n").forEach((line, i) => {
    const cells = tableCells(line);
    // Data rows are the ones whose colour cell is code-formatted.
    if (cells?.[3]?.startsWith("`") !== true) return;
    const [name = "", group = "", finish = "", colorCell = ""] = cells;
    const color = COLOR_CELL.exec(colorCell);
    if (color === null || name === "" || group === "") {
      issues.push(`line ${String(i + 1)}: unreadable row "${line.trim()}"`);
      return;
    }
    const [, first = "", second] = color;
    rows.push({
      key: `${group}/${name}`,
      group,
      name,
      code: null,
      hex: second === undefined ? first : null,
      gradient: second === undefined ? null : { dark: first, light: second },
      measuredHex: null,
      finish: finish === "" ? null : finish,
      colourless: false,
    });
  });

  return issues.length > 0 ? err(issues) : ok(rows);
}

/** How a new row of the table becomes a proposed paint (ADR-0013). */
export const SIMOGECKO_RULES: ProposalRules = {
  groups: {
    base: { rangeId: "citadel/base", type: "base", metallic: false },
    layer: { rangeId: "citadel/layer", type: "layer", metallic: false },
    shade: { rangeId: "citadel/shade", type: "wash", metallic: false },
    contrast: {
      rangeId: "citadel/contrast",
      type: "contrast",
      metallic: false,
    },
    technical: {
      rangeId: "citadel/technical",
      type: "technical",
      metallic: false,
    },
    dry: { rangeId: "citadel/dry", type: "dry", metallic: false },
  },
  metallic: (row) => row.finish === "metal",
};

/** The only group of the sampled table, which has no type column: its title. */
export const SAMPLED_GROUP = "Citadel Colours Sampled Values";

/**
 * Transcribes every row of the sampled table, literally. It only lists Base
 * and Layer paints, without their type, and no name repeats, so the key is the
 * name. It proposes no paints (its rows are keys of existing ones), so its
 * importer has no rules.
 */
export function transcribeSimoGeckoSampled(
  markdown: string,
): Result<readonly SourceRow[], readonly string[]> {
  const rows: SourceRow[] = [];
  const issues: string[] = [];

  markdown.split("\n").forEach((line, i) => {
    const cells = tableCells(line);
    // Data rows are the ones whose HEX cell is code-formatted.
    if (cells?.[2]?.startsWith("`") !== true) return;
    const [name = "", , hexCell = ""] = cells;
    const hex = HEX_CELL.exec(hexCell)?.[1];
    if (hex === undefined || name === "") {
      issues.push(`line ${String(i + 1)}: unreadable row "${line.trim()}"`);
      return;
    }
    rows.push({
      key: name,
      group: SAMPLED_GROUP,
      name,
      code: null,
      hex,
      gradient: null,
      measuredHex: null,
      finish: null,
      colourless: false,
    });
  });

  return issues.length > 0 ? err(issues) : ok(rows);
}

const HEX_CELL = /^`(#[0-9a-f]{6})`$/i;

function tableCells(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null;
  return trimmed
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}
