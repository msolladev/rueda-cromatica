// spectral.js ships no type declarations. Only what this package uses is
// declared here, following the documentation of version 3.0.0.
declare module "spectral.js" {
  export class Color {
    /** Accepts a CSS color in hex (`#rgb`, `#rrggbb`) or `rgb(…)`. */
    constructor(color: string);
    /** Tinting strength; defaults to 1. */
    tintingStrength: number;
    /** Defaults to uppercase hex (`#RRGGBB`). */
    toString(options?: { format?: "hex"; method?: "map" | "clip" }): string;
  }

  /** Mixes with Kubelka-Munk. Each color comes with its concentration factor. */
  export function mix(...colors: readonly (readonly [Color, number])[]): Color;
}
