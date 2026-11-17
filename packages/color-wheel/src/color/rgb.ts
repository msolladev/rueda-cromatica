import {
  formatHex,
  modeHsl,
  modeHsv,
  modeRgb,
  parseHex,
  useMode,
} from "culori/fn";

import { describeValue } from "../errors.ts";

/** An sRGB color with channels between 0 and 1. */
export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const toRgb = useMode(modeRgb);
const toHsv = useMode(modeHsv);
useMode(modeHsl);

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Reads a `#rgb` or `#rrggbb` hex. Any other value is an error. */
export function parseHexColor(hex: unknown): Rgb {
  if (typeof hex !== "string") {
    throw new TypeError(
      `Expected a hex color string, received ${describeValue(hex)}.`,
    );
  }
  const parsed = HEX.test(hex) ? parseHex(hex) : undefined;
  if (parsed === undefined) {
    throw new RangeError(
      `Invalid hex color ${describeValue(hex)}. Expected "#rgb" or "#rrggbb".`,
    );
  }
  return { r: parsed.r, g: parsed.g, b: parsed.b };
}

/** Writes a color as `#rrggbb`, lowercase and rounded to 8 bits. */
export function formatHexColor({ r, g, b }: Rgb): string {
  return formatHex({ mode: "rgb", r, g, b });
}

/** HSV hue in [0, 360), or `undefined` if the color has no hue (grays). */
export function hsvHue({ r, g, b }: Rgb): number | undefined {
  const { h } = toHsv({ mode: "rgb", r, g, b });
  return h === undefined ? undefined : normalizeHue(h);
}

/** HSL color with 100% saturation and 50% lightness: the digital pure. */
export function hslPure(hue: number): Rgb {
  const { r, g, b } = toRgb({ mode: "hsl", h: hue, s: 1, l: 0.5 });
  return { r, g, b };
}

export function normalizeHue(hue: number): number {
  const h = hue % 360;
  return h < 0 ? h + 360 : h;
}
