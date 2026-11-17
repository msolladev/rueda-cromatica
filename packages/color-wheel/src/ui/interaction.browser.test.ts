import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "./style.css";
import { ColorWheel, type ColorWheelEvent } from "../index.ts";
import {
  pointAt,
  RING_INNER,
  trianglePoint,
  triangleVertices,
  MARK_RADIUS,
  type Point,
} from "./geometry.ts";
import { mouseDrag, touchDrag, wheelPoint } from "./testing/input.ts";

let container: HTMLDivElement;
let wheel: ColorWheel;
let events: { type: string; source: string; hex: string }[];

function canvas(): HTMLCanvasElement {
  const element = container.querySelector("canvas");
  if (element === null) throw new Error("No canvas.");
  return element;
}

/** A point of the wheel in client coordinates, from unit coordinates. */
function at(unit: Point): Point {
  return wheelPoint(canvas(), unit);
}

function create(
  options: Partial<ConstructorParameters<typeof ColorWheel>[1]> = {},
) {
  wheel = new ColorWheel(container, {
    color: "#804000",
    model: "digital",
    harmony: "complementary",
    locale: "en",
    ...options,
  });
  events = [];
  for (const type of ["input", "change"] as const) {
    wheel.addEventListener(type, (event: ColorWheelEvent) => {
      events.push({
        type,
        source: event.detail.source,
        hex: event.detail.result.colors[0]?.hex ?? "",
      });
    });
  }
}

beforeEach(() => {
  container = document.createElement("div");
  container.style.width = "360px";
  document.body.append(container);
});

afterEach(() => {
  try {
    wheel.destroy();
  } catch {
    // Already destroyed by the test.
  }
  container.remove();
});

describe("mouse", () => {
  it("drags on the ring to change the hue, emitting input and then change", async () => {
    create();
    const ring = (RING_INNER + 1) / 2;
    await mouseDrag([
      at(pointAt(30, ring)),
      at(pointAt(90, ring)),
      at(pointAt(120, ring)),
    ]);
    expect(wheel.getState().color).toBe(wheel.color);
    expect(Math.round(hueOf())).toBe(120);
    expect(
      events.filter((event) => event.type === "input").length,
    ).toBeGreaterThan(1);
    expect(events.at(-1)).toMatchObject({ type: "change", source: "user" });
    expect(events.filter((event) => event.type === "change")).toHaveLength(1);
  });

  it("drags inside the triangle to change the proportions and keep the hue", async () => {
    create();
    const [, white] = triangleVertices(30);
    await mouseDrag([at({ x: 0, y: 0 }), at(white)]);
    // At the white vertex the base is white; the hue stays orange (30°).
    expect(wheel.color).toBe("#ffffff");
    expect(Math.round(hueOf())).toBe(30);
    expect(events.at(-1)).toMatchObject({ type: "change", source: "user" });
  });

  it("keeps a drag that leaves the triangle on its nearest edge", async () => {
    create();
    const [pure] = triangleVertices(30);
    await mouseDrag([
      at({ x: 0, y: 0 }),
      at({ x: pure.x * 1.3, y: pure.y * 1.3 }),
    ]);
    // Past the pure vertex, within the ring's gap: the pure orange.
    expect(wheel.color).toBe("#ff8000");
  });

  it("ignores a press outside the ring and the triangle", async () => {
    create();
    await mouseDrag([at({ x: 0.98, y: 0.98 }), at({ x: 0.9, y: 0.9 })]);
    expect(wheel.color).toBe("#804000");
    expect(events).toEqual([]);
  });
});

describe("touch", () => {
  it("moves the point as much as the finger, without jumping under it", async () => {
    create();
    const start = trianglePoint(positionOf(wheel));
    // The finger starts far from the point, near the black vertex.
    const [, , black] = triangleVertices(30);
    const finger = { x: (black.x + start.x) / 2, y: (black.y + start.y) / 2 };
    // The point moves by the same amount as the finger, far from it, instead
    // of jumping under it.
    const [, white] = triangleVertices(30);
    const shift = {
      x: (white.x - start.x) * 0.5,
      y: (white.y - start.y) * 0.5,
    };
    await touchDrag([
      at(finger),
      at({ x: finger.x + shift.x, y: finger.y + shift.y }),
    ]);
    const point = trianglePoint(positionOf(wheel));
    expect(point.x).toBeCloseTo(start.x + shift.x, 1);
    expect(point.y).toBeCloseTo(start.y + shift.y, 1);
    expect(events.at(-1)).toMatchObject({ type: "change", source: "user" });
  });

  it("turns the hue as much as the finger turns around the ring", async () => {
    create();
    // The finger starts at 200°, far from the base mark at 30°.
    await touchDrag([
      at(pointAt(200, MARK_RADIUS)),
      at(pointAt(220, MARK_RADIUS)),
      at(pointAt(240, MARK_RADIUS)),
    ]);
    expect(Math.round(hueOf())).toBe(70);
  });

  it("places the point where a tap lands, for big jumps", async () => {
    create();
    await touchDrag([at(pointAt(200, MARK_RADIUS))]);
    expect(Math.round(hueOf())).toBe(200);
    expect(events.map((event) => event.type)).toEqual(["input", "change"]);
  });
});

describe("keyboard", () => {
  function ring() {
    return container.querySelector<HTMLElement>(".cw-ring");
  }
  function triangle() {
    return container.querySelector<HTMLElement>(".cw-triangle");
  }

  it("reaches the ring and the triangle with Tab", async () => {
    create();
    await userEvent.tab();
    expect(document.activeElement).toBe(ring());
    await userEvent.tab();
    expect(document.activeElement).toBe(triangle());
  });

  it("turns the hue with the arrows, Shift and Page Up and Down", async () => {
    create();
    ring()?.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(hueOf()).toBeCloseTo(31, 6);
    await userEvent.keyboard("{Shift>}{ArrowUp}{/Shift}");
    expect(hueOf()).toBeCloseTo(41, 6);
    await userEvent.keyboard("{PageDown}");
    expect(hueOf()).toBeCloseTo(11, 6);
    await userEvent.keyboard("{ArrowLeft}{ArrowDown}");
    expect(hueOf()).toBeCloseTo(9, 6);
    expect(ring()?.getAttribute("aria-valuenow")).toBe("9");
    expect(ring()?.getAttribute("aria-valuetext")).toBe("9°");
    expect(events.map((event) => event.type)).toEqual(Array(5).fill("change"));
  });

  it("makes the triangle purer with Right and lighter with Up", async () => {
    // A mid gray: no pure color, half white and half black.
    create({ color: "#808080" });
    triangle()?.focus();
    expect(valueText()).toBe("0% pure, 50% white, 50% black");
    await userEvent.keyboard("{ArrowRight}");
    // Purer, keeping the ratio of white to black.
    expect(valueText()).toBe("1% pure, 50% white, 49% black");
    await userEvent.keyboard("{Shift>}{ArrowUp}{/Shift}");
    // Lighter, keeping the pure color.
    expect(valueText()).toBe("1% pure, 60% white, 39% black");
    await userEvent.keyboard("{ArrowLeft}{ArrowDown}");
    expect(valueText()).toBe("0% pure, 59% white, 41% black");
    expect(triangle()?.getAttribute("aria-valuenow")).toBe("0");
  });

  it("does nothing while the wheel is disabled", async () => {
    create({ disabled: true });
    expect(ring()?.tabIndex).toBe(-1);
    ring()?.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(hueOf()).toBeCloseTo(30, 6);
  });
});

describe("controls", () => {
  function hexInput() {
    const input = container.querySelector<HTMLInputElement>(".cw-input");
    if (input === null) throw new Error("No hex input.");
    return input;
  }

  it("changes the base from the hex field", async () => {
    create();
    await userEvent.clear(hexInput());
    await userEvent.type(hexInput(), "3daf44{Enter}");
    expect(wheel.color).toBe("#3daf44");
    expect(events.at(-1)).toMatchObject({ type: "change", source: "user" });
    expect(container.querySelector("[role=status]")?.textContent).toMatch(
      /^2 colors: Complementary\./,
    );
  });

  it("marks an invalid hex and keeps the color", async () => {
    create();
    await userEvent.clear(hexInput());
    await userEvent.type(hexInput(), "#12{Enter}");
    expect(wheel.color).toBe("#804000");
    expect(hexInput().getAttribute("aria-invalid")).toBe("true");
    const error = container.querySelector<HTMLElement>(".cw-error");
    expect(error?.hidden).toBe(false);
    expect(hexInput().getAttribute("aria-describedby")).toBe(error?.id);
    expect(events).toEqual([]);
  });

  it("changes the model, the harmony and the light from their controls", async () => {
    create({ harmony: "miniature-scheme" });
    const harmony = container.querySelector("select");
    if (harmony === null) throw new Error("No harmony selector.");
    // The model and the light are segmented controls: native radio buttons.
    await userEvent.click(page.getByRole("radio", { name: "Cold" }));
    expect(wheel.light).toBe("cold");
    await userEvent.click(page.getByRole("radio", { name: "RYB" }));
    expect(wheel.model).toBe("ryb");
    await userEvent.selectOptions(harmony, "triad");
    expect(wheel.harmony).toBe("triad");
    // The light only appears with the miniature scheme.
    expect(
      container
        .querySelectorAll(".cw-segmented-field")[1]
        ?.hasAttribute("hidden"),
    ).toBe(true);
    expect(events.map((event) => event.source)).toEqual([
      "user",
      "user",
      "user",
    ]);
  });

  it("moves between the options of a segmented control with the arrows", async () => {
    create({ model: "ryb" });
    page.getByRole("radio", { name: "RYB" }).element().focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(wheel.model).toBe("digital");
  });

  it("lists the results with their role and hex", () => {
    create();
    const items = [...container.querySelectorAll("ol > li")].map(
      (item) => item.textContent,
    );
    expect(items).toEqual(
      wheel
        .getResult()
        .colors.map(
          ({ hex }, index) => `${index === 0 ? "Base" : "Complement"} ${hex}`,
        ),
    );
  });
});

function positionOf(target: ColorWheel) {
  return ColorWheel.toWheelColor(target.color, target.model, 30);
}

/** The hue the ring announces, in whole degrees. */
function hueOf(): number {
  const ring = container.querySelector(".cw-ring");
  return Number(ring?.getAttribute("aria-valuenow") ?? Number.NaN);
}

function valueText(): string | null | undefined {
  return container
    .querySelector(".cw-triangle")
    ?.getAttribute("aria-valuetext");
}
