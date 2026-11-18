/**
 * Quality label of a ΔE2000 (docs/06 §3). The limits come from the sources
 * cited there; the visible texts belong to the web.
 */

export type MatchQuality =
  "near-identical" | "very-similar" | "similar" | "nearest-available";

/** Upper limits, inclusive, of each band. Beyond the last one: nearest-available. */
export const MATCH_QUALITY_LIMITS = Object.freeze({
  "near-identical": 1,
  "very-similar": 2,
  similar: 5,
} as const);

/** Labels the ΔE at the precision of `roundDeltaE`, as the search orders it. */
export function matchQuality(deltaE: number): MatchQuality {
  const rounded = roundDeltaE(deltaE);
  if (rounded <= MATCH_QUALITY_LIMITS["near-identical"])
    return "near-identical";
  if (rounded <= MATCH_QUALITY_LIMITS["very-similar"]) return "very-similar";
  if (rounded <= MATCH_QUALITY_LIMITS.similar) return "similar";
  return "nearest-available";
}

/**
 * ΔE rounded to 2 decimals, the precision at which results are compared and
 * labelled. Hides the last-digit differences of `Math` between engines.
 */
export const roundDeltaE = (deltaE: number): number =>
  Math.round(deltaE * 100) / 100;
