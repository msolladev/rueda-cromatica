// spectral.js no trae declaraciones de tipos. Aquí se declara solo lo que usa
// este paquete, según la documentación de la versión 3.0.0.
declare module "spectral.js" {
  export class Color {
    /** Acepta un color CSS en hex (`#rgb`, `#rrggbb`) o `rgb(…)`. */
    constructor(color: string);
    /** Fuerza de tinte; por defecto, 1. */
    tintingStrength: number;
    /** Por defecto, hex en mayúsculas (`#RRGGBB`). */
    toString(options?: { format?: "hex"; method?: "map" | "clip" }): string;
  }

  /** Mezcla con Kubelka-Munk. Cada color va con su factor de concentración. */
  export function mix(...colors: readonly (readonly [Color, number])[]): Color;
}
