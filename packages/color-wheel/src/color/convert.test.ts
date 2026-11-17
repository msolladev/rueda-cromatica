import { describe, expect, it } from "vitest";

import { fromWheelColor, toWheelColor } from "./convert.ts";
import { MODELS } from "./model.ts";
import { parseHexColor } from "./rgb.ts";
import { rybPure, rybPureHsvHue } from "./ryb.ts";
import type { WheelColor } from "./wheel-color.ts";

/** Hex de una rejilla de 16 niveles por canal: 4096 colores. */
function hexGrid(): string[] {
  const levels = Array.from({ length: 16 }, (_, i) =>
    (i * 17).toString(16).padStart(2, "0"),
  );
  return levels.flatMap((r) =>
    levels.flatMap((g) => levels.map((b) => `#${r}${g}${b}`)),
  );
}

/** Colores de la rueda repartidos por el anillo y el triángulo. */
function wheelGrid(): WheelColor[] {
  const colors: WheelColor[] = [];
  const steps = 8;
  for (let hue = 0; hue < 360; hue += 7.5) {
    for (let p = 1; p <= steps; p += 1) {
      for (let w = 0; w <= steps - p; w += 1) {
        const k = steps - p - w;
        colors.push({
          hue,
          pure: p / steps,
          white: w / steps,
          black: k / steps,
        });
      }
    }
  }
  return colors;
}

/**
 * Compara dos colores de la rueda con el margen del redondeo del hex a 8 bits.
 * Con poco color puro, el hex tiene pocos niveles de tono, así que el tono
 * solo se compara a partir de la mitad de color puro.
 */
function expectSameWheelColor(actual: WheelColor, expected: WheelColor) {
  // En RYB el color puro puede llevar algo de blanco (el azul), y el redondeo
  // de cada canal afecta a más de una proporción.
  const step = 3 / 255;
  expect(Math.abs(actual.pure - expected.pure)).toBeLessThan(step);
  expect(Math.abs(actual.white - expected.white)).toBeLessThan(step);
  expect(Math.abs(actual.black - expected.black)).toBeLessThan(step);
  if (expected.pure >= 0.5) {
    const difference = Math.abs(actual.hue - expected.hue) % 360;
    expect(Math.min(difference, 360 - difference)).toBeLessThan(1);
  }
}

function channelDistance(a: string, b: string): number {
  const x = parseHexColor(a);
  const y = parseHexColor(b);
  return Math.max(
    Math.abs(x.r - y.r),
    Math.abs(x.g - y.g),
    Math.abs(x.b - y.b),
  );
}

describe("digital model", () => {
  it("converts every hex to the wheel and back exactly", () => {
    for (const hex of hexGrid()) {
      expect(fromWheelColor(toWheelColor(hex, "digital"), "digital")).toBe(hex);
    }
  });

  it("keeps the hue and proportions of wheel colors", () => {
    for (const color of wheelGrid()) {
      const back = toWheelColor(fromWheelColor(color, "digital"), "digital");
      expectSameWheelColor(back, color);
    }
  });

  it("uses the pure colors of HSL", () => {
    const pure = (hue: number) =>
      fromWheelColor({ hue, pure: 1, white: 0, black: 0 }, "digital");
    expect(pure(0)).toBe("#ff0000");
    expect(pure(60)).toBe("#ffff00");
    expect(pure(120)).toBe("#00ff00");
    expect(pure(240)).toBe("#0000ff");
  });

  it("describes a brown as an orange with black", () => {
    expect(toWheelColor("#804000", "digital")).toEqual({
      hue: 30,
      pure: 128 / 255,
      white: 0,
      black: 1 - 128 / 255,
    });
  });
});

describe("RYB model", () => {
  it("uses the corners of Gossett and Chen as pure colors", () => {
    const pure = (hue: number) =>
      fromWheelColor({ hue, pure: 1, white: 0, black: 0 }, "ryb");
    expect(pure(0)).toBe("#ff0000");
    expect(pure(60)).toBe("#ff8000");
    expect(pure(120)).toBe("#ffff00");
    expect(pure(180)).toBe("#00a833");
    expect(pure(240)).toBe("#2a5f99");
    expect(pure(300)).toBe("#800080");
  });

  it("interpolates linearly between two corners", () => {
    expect(rybPure(30)).toEqual({ r: 1, g: 0.25, b: 0 });
  });

  it("maps RYB hues to strictly increasing HSV hues", () => {
    let previous = -Infinity;
    for (let hue = 0; hue < 360; hue += 0.25) {
      const hsv = rybPureHsvHue(hue);
      expect(hsv).toBeGreaterThan(previous);
      previous = hsv;
    }
    expect(previous).toBeLessThan(360);
  });

  it("converts wheel colors to hex and back", () => {
    for (const color of wheelGrid()) {
      const back = toWheelColor(fromWheelColor(color, "ryb"), "ryb");
      expectSameWheelColor(back, color);
    }
  });

  it("returns the same hex for colors the triangle reaches", () => {
    for (const color of wheelGrid()) {
      const hex = fromWheelColor(color, "ryb");
      expect(
        channelDistance(fromWheelColor(toWheelColor(hex, "ryb"), "ryb"), hex),
      ).toBeLessThanOrEqual(1 / 255);
    }
  });

  it("takes the nearest reachable color for a hex out of range", () => {
    const hex = "#00ffff";
    const color = toWheelColor(hex, "ryb");
    const reached = fromWheelColor(color, "ryb");
    expect(reached).not.toBe(hex);
    // Ningún punto del triángulo de ese tono está más cerca del cian.
    const error = channelSquared(reached, hex);
    for (let pure = 0; pure <= 1; pure += 0.02) {
      for (let white = 0; white <= 1 - pure + 1e-9; white += 0.02) {
        const candidate = fromWheelColor(
          { hue: color.hue, pure, white, black: Math.max(0, 1 - pure - white) },
          "ryb",
        );
        expect(channelSquared(candidate, hex)).toBeGreaterThanOrEqual(
          error - 1e-3,
        );
      }
    }
  });

  it("keeps the reached color stable on later conversions", () => {
    const reached = fromWheelColor(toWheelColor("#00ffff", "ryb"), "ryb");
    expect(fromWheelColor(toWheelColor(reached, "ryb"), "ryb")).toBe(reached);
  });
});

function channelSquared(a: string, b: string): number {
  const x = parseHexColor(a);
  const y = parseHexColor(b);
  return (x.r - y.r) ** 2 + (x.g - y.g) ** 2 + (x.b - y.b) ** 2;
}

describe.each(MODELS)("colors without hue in the %s model", (model) => {
  it.each(["#000000", "#808080", "#ffffff"])(
    "%s keeps the previous hue",
    (hex) => {
      const color = toWheelColor(hex, model, 200);
      expect(color.hue).toBe(200);
      expect(color.pure).toBeCloseTo(0, 9);
      expect(fromWheelColor(color, model)).toBe(hex);
    },
  );

  it("uses 0° when there is no previous hue", () => {
    expect(toWheelColor("#808080", model).hue).toBe(0);
  });
});

describe("invalid values", () => {
  it.each(["#12", "#12345", "#1234567", "#12345g", "red", "123456", ""])(
    "rejects the hex %j",
    (hex) => {
      expect(() => toWheelColor(hex, "ryb")).toThrow(RangeError);
    },
  );

  it("rejects a hex that is not a string", () => {
    expect(() => toWheelColor(123 as unknown as string, "ryb")).toThrow(
      TypeError,
    );
  });

  it("accepts short and uppercase hex", () => {
    expect(fromWheelColor(toWheelColor("#F00", "digital"), "digital")).toBe(
      "#ff0000",
    );
  });

  it("rejects an unknown model", () => {
    expect(() => toWheelColor("#ff0000", "cmyk" as "ryb")).toThrow(
      /Unknown model "cmyk"/,
    );
  });

  it.each([360, -1, Number.NaN])("rejects the previous hue %s", (hue) => {
    expect(() => toWheelColor("#808080", "ryb", hue)).toThrow();
  });

  it.each([
    [{ hue: 360, pure: 1, white: 0, black: 0 }, RangeError],
    [{ hue: 0, pure: 0.5, white: 0.5, black: 0.5 }, RangeError],
    [{ hue: 0, pure: 1.5, white: -0.5, black: 0 }, RangeError],
    [{ hue: 0, pure: "1", white: 0, black: 0 }, TypeError],
    [null, TypeError],
  ])("rejects the wheel color %j", (color, error) => {
    expect(() => fromWheelColor(color as WheelColor, "ryb")).toThrow(error);
  });
});
