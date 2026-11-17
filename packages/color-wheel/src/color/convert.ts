import { digitalFromRgb, digitalPure } from "./digital.ts";
import { assertModel, type Model } from "./model.ts";
import {
  formatHexColor,
  normalizeHue,
  parseHexColor,
  type Rgb,
} from "./rgb.ts";
import { rybFromRgb, rybPure } from "./ryb.ts";
import { assertHue, assertWheelColor, type WheelColor } from "./wheel-color.ts";

/** Color puro del tono `hue` en el anillo del modelo. */
export function pureColor(hue: number, model: Model): Rgb {
  return model === "ryb" ? rybPure(hue) : digitalPure(hue);
}

/**
 * Convierte un hex a la rueda del modelo (docs/05 §3). Los colores sin tono
 * (blancos, grises y negros puros) conservan `previousHue`, el tono que tenía
 * la rueda.
 */
export function toWheelColor(
  hex: string,
  model: Model,
  previousHue = 0,
): WheelColor {
  const rgb = parseHexColor(hex);
  assertModel(model);
  assertHue(previousHue, "previousHue");
  return model === "ryb"
    ? rybFromRgb(rgb, previousHue)
    : digitalFromRgb(rgb, previousHue);
}

/**
 * Convierte un color de la rueda a hex: la suma ponderada, en sRGB, del color
 * puro, el blanco y el negro (docs/05 §2).
 */
export function fromWheelColor(color: WheelColor, model: Model): string {
  assertWheelColor(color);
  assertModel(model);
  const pure = pureColor(color.hue, model);
  const mix = (channel: number) => clamp01(color.pure * channel + color.white);
  return formatHexColor({ r: mix(pure.r), g: mix(pure.g), b: mix(pure.b) });
}

/** Gira el tono `degrees` grados y conserva las proporciones. */
export function rotate(color: WheelColor, degrees: number): WheelColor {
  return { ...color, hue: normalizeHue(color.hue + degrees) };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
