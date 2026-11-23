/**
 * The colour discrepancies between sources (docs/04 §6, step 9; ADR-0031):
 * every paint whose published colour and a losing candidate are further apart
 * than the similarity limit of docs/06 §3. A report to review in the git diff,
 * never a failure. Pure.
 */
import {
  colorDifference,
  matchQuality,
  type PaintColor,
  type PaintId,
} from "@chromatic-wheel/domain";
import type { Candidate } from "./color.ts";

/** One paint and one of its losing candidates, too far from its colour. */
export interface Discrepancy {
  readonly paintId: PaintId;
  readonly published: PaintColor;
  readonly other: PaintColor;
  /** ΔE2000 between the two, rounded to 2 decimals. */
  readonly deltaE2000: number;
}

/**
 * The losing candidates of a paint that are not similar to its colour: those
 * labelled `barely-similar` by `matchQuality`, ΔE > 5. In the order of the
 * candidates, by priority.
 */
export function colorDiscrepancies(
  paintId: PaintId,
  published: PaintColor | null,
  others: readonly Candidate[],
): readonly Discrepancy[] {
  if (published === null) return [];
  return others.flatMap(({ color: other }) => {
    const deltaE = colorDifference(published.hex, other.hex);
    if (!deltaE.ok) throw new Error(`Builder bug: ${deltaE.error.kind}`);
    return matchQuality(deltaE.value) === "barely-similar"
      ? [{ paintId, published, other, deltaE2000: roundDeltaE(deltaE.value) }]
      : [];
  });
}

/** 2 decimals, the precision at which docs/06 §4 compares ΔE. */
export const roundDeltaE = (deltaE: number): number =>
  Math.round(deltaE * 100) / 100;
