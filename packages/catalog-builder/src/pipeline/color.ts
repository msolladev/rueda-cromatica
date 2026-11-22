/**
 * The colour of each paint (docs/04 §6, step 3; ADR-0014, ADR-0031): the
 * candidates of the rows of its sources, with the origin that
 * `color-policy.json` gives each source, chosen by priority unless the paint
 * rejects some or chooses one by hand. Pure.
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
import type {
  ColorChoice,
  ColorPolicy,
  RejectedColor,
  SourceFile,
  SourceRow,
} from "../curated/files.ts";
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

/** A colour a row offers, with where the row is written. */
export interface Candidate {
  readonly color: PaintColor;
  readonly at: ResolvedRow["at"];
}

/** What a paint says about its candidates (docs/04 §4). */
export interface ColorCorrections {
  readonly colorChoice: ColorChoice | null;
  readonly rejectedColors: readonly RejectedColor[];
}

/** A problem with a paint's colour, at a path inside the paint. */
export interface ColorIssue {
  /** Relative to the paint: `colorChoice`, `rejectedColors[0]` or empty. */
  readonly path: string;
  readonly message: string;
}

export interface ColorSelection {
  /** The published colour, or `null` if no candidate is left. */
  readonly color: PaintColor | null;
  /** The candidates that lose, neither published nor rejected, by priority. */
  readonly others: readonly Candidate[];
}

const ORIGIN_PRIORITY: readonly ColorOrigin[] = [
  "measured",
  "manufacturer",
  "community",
];

/**
 * Every candidate of a paint, from the best to the worst (ADR-0014): by
 * origin, `measured` > `manufacturer` > `community`, and within an origin by
 * the order of its list in `color-policy.json`.
 */
export function colorCandidates(
  rows: readonly ResolvedRow[],
  policy: ColorPolicy,
): readonly Candidate[] {
  const byPriority = (a: PaintColor, b: PaintColor): number =>
    ORIGIN_PRIORITY.indexOf(a.origin) - ORIGIN_PRIORITY.indexOf(b.origin) ||
    policy[a.origin].indexOf(a.sourceId) - policy[b.origin].indexOf(b.sourceId);
  return rows
    .flatMap(({ sourceId, row, at }) =>
      candidatesOf(sourceId, row, policy).map((color) => ({ color, at })),
    )
    .sort((a, b) => byPriority(a.color, b.color));
}

/**
 * The colour of a paint (docs/04 §6, step 3): its rejected candidates are left
 * out, and its manual choice, if any, wins over the priority. A rejection or a
 * choice that no longer matches a candidate fails, naming the candidate that
 * would be published without it (ADR-0019, decision 4). The rows of the
 * disabled sources give no candidates, and a rejection or a choice of one of
 * them fails too, so that it is reviewed.
 */
export function selectColor(
  rows: readonly ResolvedRow[],
  policy: ColorPolicy,
  corrections: ColorCorrections,
  disabledSources: ReadonlySet<SourceId> = new Set(),
): Result<ColorSelection, readonly ColorIssue[]> {
  const candidates = colorCandidates(
    rows.filter(({ sourceId }) => !disabledSources.has(sourceId)),
    policy,
  );
  const issues: ColorIssue[] = [];
  const noColor = (ref: CandidateRef): string =>
    disabledSources.has(ref.sourceId)
      ? `${ref.sourceId} is disabled`
      : `${describeRef(ref)} gives no colour for this paint`;
  const find = (ref: CandidateRef): Candidate | undefined =>
    candidates.find(({ color }) => sameCandidate(color, ref));

  const rejected = new Set<Candidate>();
  corrections.rejectedColors.forEach((rejection, i) => {
    const path = `rejectedColors[${String(i)}]`;
    const candidate = find(rejection);
    if (candidate === undefined) {
      issues.push({
        path,
        message: `${noColor(rejection)}; remove the stale rejection`,
      });
    } else if (rejected.has(candidate)) {
      issues.push({
        path,
        message: `${describeRef(rejection)} is already rejected`,
      });
    } else if (candidate.color.hex !== rejection.hex) {
      issues.push({
        path: `${path}.hex`,
        message: `${describeRef(rejection)} now gives ${candidate.color.hex}, not ${rejection.hex} (${located(candidate)}); review the rejection and update its hex or remove it`,
      });
    }
    if (candidate !== undefined) rejected.add(candidate);
  });
  const remaining = candidates.filter((c) => !rejected.has(c));
  const next = (exclude?: Candidate): string => {
    const candidate = remaining.find((c) => c !== exclude);
    return candidate === undefined
      ? "without it the paint has no colour"
      : `without it: ${describe(candidate)}`;
  };

  let chosen = remaining[0];
  const choice = corrections.colorChoice;
  if (choice !== null) {
    const candidate = find(choice);
    if (candidate === undefined) {
      issues.push({
        path: "colorChoice",
        message: `${noColor(choice)}; ${next()}`,
      });
    } else if (rejected.has(candidate)) {
      issues.push({
        path: "colorChoice",
        message: `${describeRef(choice)} is also rejected; keep only one of the two`,
      });
    } else if (candidate.color.hex !== choice.hex) {
      issues.push({
        path: "colorChoice.hex",
        message: `${describeRef(choice)} now gives ${candidate.color.hex}, not ${choice.hex} (${located(candidate)}); review the choice and update its hex or remove it; ${next(candidate)}`,
      });
    } else if (candidate === remaining[0]) {
      issues.push({
        path: "colorChoice",
        message: `The priority already picks ${describeRef(choice)}; remove the choice`,
      });
    } else {
      chosen = candidate;
    }
  }
  if (issues.length > 0) return err(issues);

  return ok({
    color: chosen?.color ?? null,
    others: remaining.filter((c) => c !== chosen),
  });
}

type CandidateRef = Pick<PaintColor, "sourceId" | "origin">;

const sameCandidate = (a: CandidateRef, b: CandidateRef): boolean =>
  a.sourceId === b.sourceId && a.origin === b.origin;

const describeRef = ({ sourceId, origin }: CandidateRef): string =>
  `${sourceId} (${origin})`;

const located = ({ at }: Candidate): string => `${at.file} ${at.path}`;

const describe = (candidate: Candidate): string =>
  `${candidate.color.hex} from ${describeRef(candidate.color)}, ${located(candidate)}`;

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
