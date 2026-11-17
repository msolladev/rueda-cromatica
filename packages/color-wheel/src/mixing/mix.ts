import { Color, mix } from "spectral.js";

/**
 * Mezcla dos colores como pigmentos (Kubelka-Munk, con spectral.js y la fuerza
 * de tinte por defecto). `ratio` es la parte de `other` en la mezcla, entre 0
 * y 1. Recibe y devuelve hex `#rrggbb`.
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
