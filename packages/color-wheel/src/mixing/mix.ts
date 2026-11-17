import { Color, mix } from "spectral.js";

/**
 * Mixes two colors as pigments (Kubelka-Munk, with spectral.js and the default
 * tinting strength). `ratio` is the share of `other` in the mix, between 0
 * and 1. Takes and returns `#rrggbb` hexes.
 */
export function mixPaint(base: string, other: string, ratio: number): string {
  if (!(ratio >= 0 && ratio <= 1)) {
    throw new RangeError(
      `Expected a mix ratio in [0, 1], received ${String(ratio)}.`,
    );
  }
  return mix([new Color(base), 1 - ratio], [new Color(other), ratio])
    .toString()
    .toLowerCase();
}
