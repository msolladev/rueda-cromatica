/**
 * The colour of each paint (docs/04 §6, step 3; ADR-0014): taken from the
 * rows of its sources, with the origin that `color-policy.json` gives each
 * source. Pure.
 */
import { converter, formatHex } from "culori";
import {
  err,
  ok,
  toHexColor,
  type ColorOrigin,
  type PaintColor,
  type Result,
  type SourceId,
} from "@chromatic-wheel/domain";
import type { ColorPolicy, SourceFile, SourceRow } from "../curated/files.ts";
import type { ResolvedRow } from "./resolve.ts";

const toLab = converter("lab65");
const toRgb = converter("rgb");

/**
 * Midpoint of a two-colour gradient in CIELAB (D65 white). If it falls outside
 * sRGB, `formatHex` clips each channel.
 */
export function gradientMidpoint(from: string, to: string): string {
  const a = toLab(from);
  const b = toLab(to);
  if (a === undefined || b === undefined) {
    throw new Error(`Not a colour: ${from} or ${to}`);
  }
  return formatHex(
    toRgb({
      mode: "lab65",
      l: (a.l + b.l) / 2,
      a: (a.a + b.a) / 2,
      b: (a.b + b.b) / 2,
    }),
  );
}

/**
 * Checks the policy against the sources: every listed source exists, and
 * every source that gives a hex or a gradient is in one hex list.
 */
export function checkColorPolicy(
  policy: ColorPolicy,
  sources: readonly SourceFile[],
): readonly string[] {
  const ids = new Set(sources.map((s) => s.source.id));
  const listed = new Set<string>([...policy.manufacturer, ...policy.community]);
  const issues: string[] = [];
  for (const origin of ["measured", "manufacturer", "community"] as const) {
    policy[origin].forEach((id, i) => {
      if (!ids.has(id)) {
        issues.push(`${origin}[${String(i)}]: unknown source ${id}`);
      }
    });
  }
  for (const { source, paints } of sources) {
    const givesHex = paints.some((r) => r.hex !== null || r.gradient !== null);
    if (givesHex && !listed.has(source.id)) {
      issues.push(
        `${source.id} gives colours but is neither in manufacturer nor in community`,
      );
    }
  }
  return issues;
}

/**
 * The colour of a paint from its rows, or `null` if none gives one. Several
 * candidates are an error until phase 5 step 2 chooses between them.
 */
export function paintColor(
  rows: readonly ResolvedRow[],
  policy: ColorPolicy,
): Result<PaintColor | null, string> {
  const candidates = rows.flatMap(({ sourceId, row }) =>
    candidatesOf(sourceId, row, policy),
  );
  if (candidates.length > 1) {
    const from = candidates.map((c) => `${c.sourceId} (${c.origin})`);
    return err(
      `Several colour candidates (${from.join(", ")}); choosing between them is not supported yet`,
    );
  }
  return ok(candidates[0] ?? null);
}

function candidatesOf(
  sourceId: SourceId,
  row: SourceRow,
  policy: ColorPolicy,
): PaintColor[] {
  const candidates: PaintColor[] = [];
  const origin: ColorOrigin = policy.manufacturer.includes(sourceId)
    ? "manufacturer"
    : "community";
  const hex =
    row.gradient === null
      ? row.hex
      : gradientMidpoint(row.gradient.dark, row.gradient.light);
  if (hex !== null) candidates.push(color(hex, origin, sourceId));
  if (row.measuredHex !== null && policy.measured.includes(sourceId)) {
    candidates.push(color(row.measuredHex, "measured", sourceId));
  }
  return candidates;
}

function color(
  hex: string,
  origin: ColorOrigin,
  sourceId: SourceId,
): PaintColor {
  const normalised = toHexColor(hex);
  if (normalised === null) throw new Error(`Not a hex: ${hex}`);
  return { hex: normalised, origin, sourceId };
}
