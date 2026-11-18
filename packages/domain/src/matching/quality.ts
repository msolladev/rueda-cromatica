/**
 * Quality label of a ΔE2000 (docs/06 §3). The limits come from the sources
 * cited there; the visible texts belong to the web.
 */

/**
 * How close a paint is, by its ΔE2000 rounded to 2 decimals. The limits are
 * in {@link MATCH_QUALITY_LIMITS}:
 *
 * - `"near-identical"`: below what can be perceived;
 * - `"very-similar"`: within the demanding tolerance;
 * - `"similar"`: within the less demanding tolerance;
 * - `"nearest-available"`: the closest there is, without claiming that it is
 *   similar.
 */
export type MatchQuality =
  "near-identical" | "very-similar" | "similar" | "nearest-available";

/** Upper limits, inclusive, of each band. Beyond the last one: nearest-available. */
export const MATCH_QUALITY_LIMITS = Object.freeze({
  /** Up to 1, about the smallest perceptible difference. */
  "near-identical": 1,
  /** Up to 2. */
  "very-similar": 2,
  /** Up to 5. */
  similar: 5,
} as const);

/**
 * The quality label of a ΔE2000, rounded to 2 decimals first, as the search
 * orders them.
 */
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
