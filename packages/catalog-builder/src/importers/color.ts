/**
 * Colour normalisation shared by the importers (docs/04 §4, ADR-0014).
 */
import { converter, formatHex } from "culori";

const HEX = /^#[0-9a-f]{6}$/i;

const toLab = converter("lab65");
const toRgb = converter("rgb");

/** Lowercase `#rrggbb`, or `null` if the text is not a 6-digit hex. */
export function normalizeHex(text: string): string | null {
  return HEX.test(text) ? text.toLowerCase() : null;
}

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
