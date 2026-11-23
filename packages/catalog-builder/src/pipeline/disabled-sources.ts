/**
 * The summary of the disabled sources (docs/04 §6, ADR-0032): the same build
 * with every source enabled and without the disabled ones, compared. It shows
 * exactly what disabling them changes, whatever else changed in the data, and
 * it stays the same while they stay disabled. A report to review in the git
 * diff, never a failure. Pure.
 */
import {
  colorDifference,
  type OfficialEquivalence,
  type PaintColor,
  type PaintId,
  type Replacement,
  type SourceId,
} from "@chromatic-wheel/domain";
import { roundDeltaE } from "./discrepancies.ts";

/** A paint whose colour is not the same with the disabled sources enabled. */
export interface ColorChange {
  readonly paintId: PaintId;
  /** The colour published, without the disabled sources. */
  readonly published: PaintColor | null;
  /** The colour it would have with every source enabled. */
  readonly ifEnabled: PaintColor | null;
  /** ΔE2000 between the two, rounded to 2 decimals; `null` if one is missing. */
  readonly deltaE2000: number | null;
}

/** A paint whose replacement is not the same with the disabled sources enabled. */
export interface ReplacementChange {
  readonly paintId: PaintId;
  /** The replacement published, without the disabled sources. */
  readonly published: Replacement | null;
  /** The one it would have with every source enabled. */
  readonly ifEnabled: Replacement | null;
}

/**
 * The summary: the colours, the official equivalences and the replacements
 * that the disabled sources change.
 */
export interface DisabledSourcesReport {
  /** Sorted by ID. */
  readonly disabledSources: readonly SourceId[];
  /** In the order of the paints of `catalog.json`. */
  readonly colors: readonly ColorChange[];
  /**
   * The edges that the disabled sources would publish, in the order of
   * `catalog.json` (docs/02 §1).
   */
  readonly equivalences: readonly OfficialEquivalence[];
  /** In the order of the paints of `catalog.json`. */
  readonly replacements: readonly ReplacementChange[];
}

const sameColor = (a: PaintColor | null, b: PaintColor | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.hex === b.hex &&
    a.origin === b.origin &&
    a.sourceId === b.sourceId);

/** The change of one paint, or `null` if disabling does not change it. */
export function colorChange(
  paintId: PaintId,
  published: PaintColor | null,
  ifEnabled: PaintColor | null,
): ColorChange | null {
  if (sameColor(published, ifEnabled)) return null;
  let deltaE2000: number | null = null;
  if (published !== null && ifEnabled !== null) {
    const deltaE = colorDifference(published.hex, ifEnabled.hex);
    if (!deltaE.ok) throw new Error(`Builder bug: ${deltaE.error.kind}`);
    deltaE2000 = roundDeltaE(deltaE.value);
  }
  return { paintId, published, ifEnabled, deltaE2000 };
}

/** The change of one replacement, or `null` if disabling does not change it. */
export function replacementChange(
  paintId: PaintId,
  published: Replacement | null,
  ifEnabled: Replacement | null,
): ReplacementChange | null {
  const same =
    published === ifEnabled ||
    (published !== null &&
      ifEnabled !== null &&
      published.paintId === ifEnabled.paintId &&
      published.sourceId === ifEnabled.sourceId);
  return same ? null : { paintId, published, ifEnabled };
}

/** The summary the builder prints; nothing if no source is disabled. */
export function formatDisabledSources(
  report: DisabledSourcesReport,
): readonly string[] {
  if (report.disabledSources.length === 0) return [];
  const lost = report.colors.filter((c) => c.published === null).length;
  return [
    `Disabled sources: ${report.disabledSources.join(", ")}.`,
    `  ${String(report.colors.length)} paint(s) change colour, ${String(lost)} of them left without colour.`,
    `  ${String(report.equivalences.length)} official equivalence(s) left out.`,
    `  ${String(report.replacements.length)} replacement(s) change.`,
  ];
}
