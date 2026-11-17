import {
  formatHex,
  modeHsl,
  modeHsv,
  modeRgb,
  parseHex,
  useMode,
} from "culori/fn";

import { describeValue } from "../errors.ts";

/** Un color sRGB con los canales entre 0 y 1. */
export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const toRgb = useMode(modeRgb);
const toHsv = useMode(modeHsv);
useMode(modeHsl);

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Lee un hex `#rgb` o `#rrggbb`. Cualquier otro valor es un error. */
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

/** Escribe un color como `#rrggbb`, en minúsculas y redondeado a 8 bits. */
export function formatHexColor({ r, g, b }: Rgb): string {
  return formatHex({ mode: "rgb", r, g, b });
}

/** Tono HSV en [0, 360), o `undefined` si el color no tiene tono (grises). */
export function hsvHue({ r, g, b }: Rgb): number | undefined {
  const { h } = toHsv({ mode: "rgb", r, g, b });
  return h === undefined ? undefined : normalizeHue(h);
}

/** Color de HSL con saturación 100 % y luminosidad 50 %: el puro digital. */
export function hslPure(hue: number): Rgb {
  const { r, g, b } = toRgb({ mode: "hsl", h: hue, s: 1, l: 0.5 });
  return { r, g, b };
}

export function normalizeHue(hue: number): number {
  const h = hue % 360;
  return h < 0 ? h + 360 : h;
}
