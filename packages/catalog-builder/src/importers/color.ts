/**
 * Colour normalisation shared by the importers (docs/04 §4, ADR-0014).
 */
import { converter, formatHex } from "culori";

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
