import { fromWheelColor, rotate } from "../color/convert.ts";
import type { Model } from "../color/model.ts";
import { normalizeHue } from "../color/rgb.ts";
import type { WheelColor } from "../color/wheel-color.ts";
import { describeValue, oneOf } from "../errors.ts";
import { mixPaint } from "../mixing/mix.ts";
import { LIGHT_RATIO, LIGHTEN_RATIO, SHADOW_RATIO } from "../mixing/ratios.ts";

/** Tipo de luz: cálida (hacia el amarillo) o fría (hacia el azul). */
export const LIGHTS = ["warm", "cold"] as const;

export type Light = (typeof LIGHTS)[number];

export function assertLight(value: unknown): asserts value is Light {
  if (!LIGHTS.includes(value as Light)) {
    throw new RangeError(
      `Unknown light ${describeValue(value)}. Expected ${oneOf(LIGHTS)}.`,
    );
  }
}

/** Tono del destino de la luz en cada modelo (docs/05 §5.2). */
const DESTINATIONS: Readonly<Record<Model, Readonly<Record<Light, number>>>> = {
  ryb: { warm: 120, cold: 240 },
  digital: { warm: 60, cold: 240 },
};

/** Cuánto se desplaza el vecino: un paso de la rueda de 12 tonos. */
const NEIGHBOR_STEP = 30;

/** Mitad de un paso: hasta aquí, la base está en el segmento del destino. */
const DESTINATION_SEGMENT = NEIGHBOR_STEP / 2;

const WHITE = "#ffffff";

/** La sombra: la base mezclada con su complementario (docs/05 §5.1). */
export function shadowHex(base: WheelColor, model: Model): string {
  return mixPaint(
    fromWheelColor(base, model),
    fromWheelColor(rotate(base, 180), model),
    SHADOW_RATIO,
  );
}

/**
 * El vecino de la base hacia el destino de la luz (docs/05 §5.2, pasos 2 y 3),
 * antes de aclararlo.
 */
export function neighborHex(
  base: WheelColor,
  model: Model,
  light: Light,
): string {
  const destination = DESTINATIONS[model][light];
  // Distancia hacia los ángulos crecientes. Si los dos caminos miden 180°,
  // gana este sentido.
  const forward = normalizeHue(destination - base.hue);
  const distance = Math.min(forward, 360 - forward);

  if (distance <= DESTINATION_SEGMENT) {
    // Cálida: el amarillo puro del modelo. Fría: el blanco.
    return light === "warm"
      ? fromWheelColor({ hue: destination, pure: 1, white: 0, black: 0 }, model)
      : WHITE;
  }
  const step = Math.min(NEIGHBOR_STEP, distance);
  return fromWheelColor(rotate(base, forward <= 180 ? step : -step), model);
}

/** La luz: la base mezclada con su vecino aclarado (docs/05 §5.2). */
export function lightHex(base: WheelColor, model: Model, light: Light): string {
  const lightened = mixPaint(
    neighborHex(base, model, light),
    WHITE,
    LIGHTEN_RATIO,
  );
  return mixPaint(fromWheelColor(base, model), lightened, LIGHT_RATIO);
}
