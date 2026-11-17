import { fromWheelColor, rotate } from "../color/convert.ts";
import type { Model } from "../color/model.ts";
import { normalizeHue } from "../color/rgb.ts";
import type { WheelColor } from "../color/wheel-color.ts";
import { describeValue, oneOf } from "../errors.ts";
import { mixPaint } from "../mixing/mix.ts";
import { LIGHT_RATIO, LIGHTEN_RATIO, SHADOW_RATIO } from "../mixing/ratios.ts";

/** Light type: warm (towards yellow) or cold (towards blue). */
export const LIGHTS = ["warm", "cold"] as const;

export type Light = (typeof LIGHTS)[number];

export function assertLight(value: unknown): asserts value is Light {
  if (!LIGHTS.includes(value as Light)) {
    throw new RangeError(
      `Unknown light ${describeValue(value)}. Expected ${oneOf(LIGHTS)}.`,
    );
  }
}

/** Hue of the light destination in each model (docs/05 §5.2). */
const DESTINATIONS: Readonly<Record<Model, Readonly<Record<Light, number>>>> = {
  ryb: { warm: 120, cold: 240 },
  digital: { warm: 60, cold: 240 },
};

/** How far the neighbor moves: one step of the 12-hue wheel. */
const NEIGHBOR_STEP = 30;

/** Half a step: up to here, the base is in the destination's segment. */
const DESTINATION_SEGMENT = NEIGHBOR_STEP / 2;

const WHITE = "#ffffff";

/** The shadow: the base mixed with its complement (docs/05 §5.1). */
export function shadowHex(base: WheelColor, model: Model): string {
  return mixPaint(
    fromWheelColor(base, model),
    fromWheelColor(rotate(base, 180), model),
    SHADOW_RATIO,
  );
}

/**
 * The neighbor of the base towards the light destination (docs/05 §5.2,
 * steps 2 and 3), before lightening it.
 */
export function neighborHex(
  base: WheelColor,
  model: Model,
  light: Light,
): string {
  const destination = DESTINATIONS[model][light];
  // Distance towards increasing angles. If both paths measure 180°, this
  // direction wins.
  const forward = normalizeHue(destination - base.hue);
  const distance = Math.min(forward, 360 - forward);

  if (distance <= DESTINATION_SEGMENT) {
    // Warm: the model's pure yellow. Cold: white.
    return light === "warm"
      ? fromWheelColor({ hue: destination, pure: 1, white: 0, black: 0 }, model)
      : WHITE;
  }
  const step = Math.min(NEIGHBOR_STEP, distance);
  return fromWheelColor(rotate(base, forward <= 180 ? step : -step), model);
}

/** The light: the base mixed with its lightened neighbor (docs/05 §5.2). */
export function lightHex(base: WheelColor, model: Model, light: Light): string {
  const lightened = mixPaint(
    neighborHex(base, model, light),
    WHITE,
    LIGHTEN_RATIO,
  );
  return mixPaint(fromWheelColor(base, model), lightened, LIGHT_RATIO);
}
