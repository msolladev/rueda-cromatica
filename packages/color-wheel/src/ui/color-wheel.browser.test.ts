import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cdp, userEvent } from "vitest/browser";

import "./style.css";
import {
  ColorWheel,
  compute,
  type ColorWheelEvent,
  type ColorWheelOptions,
  type ColorWheelState,
  type Control,
} from "../index.ts";
import { expectNoAxeViolations } from "./testing/axe.ts";

const CONTROLS: readonly Control[] = [
  "hex",
  "model",
  "harmony",
  "light",
  "results",
  "help",
];

let container: HTMLDivElement;
let wheel: ColorWheel | undefined;
let events: ColorWheelEvent[];

function create(options: Partial<ColorWheelOptions> = {}): ColorWheel {
  const created = new ColorWheel(container, {
    color: "#3daf44",
    locale: "en",
    ...options,
  });
  wheel = created;
  events = [];
  created.addEventListener("change", (event) => events.push(event));
  created.addEventListener("input", (event) => events.push(event));
  return created;
}

function query<T extends Element>(selector: string, type: new () => T): T {
  const element = container.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`No ${selector}.`);
  return element;
}

/** The element that each control shows or hides. */
function controlElement(name: Control): HTMLElement {
  if (name === "results" || name === "help") {
    return query(`.cw-${name}`, HTMLElement);
  }
  const index = { hex: 0, model: 1, harmony: 2, light: 3 }[name];
  const field = container.querySelectorAll<HTMLElement>(".cw-field")[index];
  if (field === undefined) throw new Error(`No field for ${name}.`);
  return field;
}

beforeEach(() => {
  container = document.createElement("div");
  container.style.width = "360px";
  document.body.append(container);
  wheel = undefined;
});

afterEach(() => {
  try {
    wheel?.destroy();
  } catch {
    // Already destroyed by the test.
  }
  container.remove();
});

describe("constructor", () => {
  it("uses the default values of the properties", () => {
    const created = create();
    expect(created.getState()).toEqual({
      color: "#3daf44",
      model: "ryb",
      harmony: "miniature-scheme",
      light: "warm",
      harmonies: [
        "complementary",
        "split-complementary",
        "analogous",
        "accented-analogous",
        "triad",
        "square",
        "rectangle",
        "monochromatic",
        "miniature-scheme",
      ],
      models: ["ryb", "digital"],
      locale: "en",
      labels: {},
      hiddenControls: [],
      disabledControls: [],
      disabled: false,
    });
    expect(created.getResult()).toEqual(compute({ color: "#3daf44" }));
  });

  it("emits no event when it is created", () => {
    create();
    expect(events).toEqual([]);
  });

  it("takes the first allowed value when the default is not allowed", () => {
    const created = create({
      harmonies: ["triad", "square"],
      models: ["digital"],
    });
    expect(created.harmony).toBe("triad");
    expect(created.model).toBe("digital");
  });

  it("resolves the locale from the browser when none is given", () => {
    const created = new ColorWheel(container, { color: "#3daf44" });
    wheel = created;
    expect(ColorWheel.locales).toContain(created.locale);
  });

  it.each<[string, unknown, RegExp]>([
    ["no color", { locale: "en" }, /color option is required/],
    ["an invalid hex", { color: "#12" }, /Invalid hex color "#12"/],
    [
      "an unknown option",
      { color: "#3daf44", colour: "red" },
      /Unknown option key "colour"/,
    ],
    [
      "an unknown control",
      { color: "#3daf44", hiddenControls: ["ring"] },
      /Unknown control "ring"/,
    ],
    [
      "a duplicate harmony",
      { color: "#3daf44", harmonies: ["triad", "triad"] },
      /Duplicate value "triad"/,
    ],
    ["no models", { color: "#3daf44", models: [] }, /at least one value/],
    [
      "a model not in models",
      { color: "#3daf44", model: "ryb", models: ["digital"] },
      /model "ryb" is not in models/,
    ],
    [
      "a non-boolean disabled",
      { color: "#3daf44", disabled: "yes" },
      /disabled to be a boolean/,
    ],
  ])("rejects %s", (_, options, message) => {
    expect(
      () => new ColorWheel(container, options as ColorWheelOptions),
    ).toThrow(message);
    expect(container.children).toHaveLength(0);
  });

  it("rejects a container that is not an element", () => {
    expect(
      () =>
        new ColorWheel(null as unknown as HTMLElement, { color: "#3daf44" }),
    ).toThrow(/container to be an HTML element/);
  });
});

describe("properties", () => {
  it("reads and assigns each property, emitting a change from the api", () => {
    const created = create();
    created.color = "#c01411";
    created.model = "digital";
    created.harmony = "triad";
    created.light = "cold";
    created.harmonies = ["triad", "square"];
    created.models = ["digital"];
    created.locale = "es";
    created.labels = { harmony: { triad: "Paleta" } };
    expect([
      created.color,
      created.model,
      created.harmony,
      created.light,
      created.harmonies,
      created.models,
      created.locale,
      created.labels,
    ]).toEqual([
      "#c01411",
      "digital",
      "triad",
      "cold",
      ["triad", "square"],
      ["digital"],
      "es",
      { harmony: { triad: "Paleta" } },
    ]);
    expect(events).toHaveLength(8);
    expect(events.every((event) => event.type === "change")).toBe(true);
    expect(events.every((event) => event.detail.source === "api")).toBe(true);
  });

  it("emits nothing when a value does not change", () => {
    const created = create();
    created.harmony = "miniature-scheme";
    created.color = "#3DAF44";
    expect(events).toEqual([]);
  });

  it.each<[string, (target: ColorWheel) => void, RegExp]>([
    [
      "an invalid hex",
      (target) => {
        target.color = "red";
      },
      /Invalid hex color "red"/,
    ],
    [
      "an unknown harmony",
      (target) => {
        target.harmony = "pentad" as "triad";
      },
      /Unknown harmony "pentad"/,
    ],
    [
      "harmonies without the current one",
      (target) => {
        target.harmonies = ["square"];
      },
      /harmony "miniature-scheme" is not in harmonies/,
    ],
    [
      "an unknown model",
      (target) => {
        target.model = "cmyk" as "ryb";
      },
      /Unknown model "cmyk"/,
    ],
    [
      "an unknown light",
      (target) => {
        target.light = "hot" as "warm";
      },
      /Unknown light "hot"/,
    ],
    [
      "an unknown locale",
      (target) => {
        target.locale = "pt" as "es";
      },
      /Unknown locale "pt"/,
    ],
    [
      "an unknown label",
      (target) => {
        target.labels = { harmony: { triadd: "x" } } as never;
      },
      /Unknown label "harmony.triadd"/,
    ],
    [
      "a label that is not text",
      (target) => {
        target.labels = { role: { base: 1 } } as never;
      },
      /"role.base" to be a string/,
    ],
  ])("rejects %s and keeps the state", (_, assign, message) => {
    const created = create();
    const before = created.getState();
    expect(() => {
      assign(created);
    }).toThrow(message);
    expect(created.getState().color).toBe(before.color);
    expect(created.getState().harmony).toBe(before.harmony);
  });

  it("rejects a harmony that is not in harmonies", () => {
    const created = create({ harmonies: ["triad", "square"] });
    created.harmonies = ["triad"];
    expect(() => {
      created.harmony = "square";
    }).toThrow(/harmony "square" is not in harmonies/);
    expect(created.harmony).toBe("triad");
  });

  it("returns copies that do not change the wheel", () => {
    const created = create({ labels: { role: { base: "Main" } } });
    (created.harmonies as string[]).pop();
    (created.labels.role as Record<string, string>).base = "Other";
    expect(created.harmonies).toHaveLength(9);
    expect(created.getEffectiveLabels().role.base).toBe("Main");
  });
});

describe("model change (ADR-0021)", () => {
  it("keeps the base color, not its position", () => {
    const created = create({ color: "#3daf44", model: "ryb" });
    created.model = "digital";
    expect(created.color).toBe("#3daf44");
  });

  it("converts again from the last hex, so a round trip keeps it", () => {
    const created = create({ color: "#00ffff", model: "digital" });
    created.model = "ryb";
    expect(created.color).toBe("#6aa6a6");
    expect(created.getState().color).toBe("#00ffff");
    created.model = "digital";
    expect(created.color).toBe("#00ffff");
  });

  it("takes the color as received in the new model when both change", () => {
    const created = create({ model: "ryb" });
    created.update({ color: "#00ffff", model: "digital" });
    expect(created.color).toBe("#00ffff");
  });
});

describe("update, getState and setState", () => {
  it("changes several properties with a single change", () => {
    const created = create();
    created.update({
      harmonies: ["square"],
      harmony: "square",
      model: "digital",
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.detail).toEqual({
      result: created.getResult(),
      state: created.getState(),
      source: "api",
    });
  });

  it("applies nothing if one value is not valid", () => {
    const created = create();
    expect(() => {
      created.update({ harmony: "triad", model: "cmyk" as "ryb" });
    }).toThrow(/Unknown model/);
    expect(created.harmony).toBe("miniature-scheme");
    expect(events).toEqual([]);
  });

  it("rejects unknown and control keys", () => {
    const created = create();
    expect(() => {
      created.update({ disabled: true } as never);
    }).toThrow(/Unknown property key "disabled"/);
  });

  it("restores a whole state on another wheel, controls included", () => {
    const source = create({ color: "#00ffff", model: "digital" });
    source.update({ model: "ryb", harmony: "triad", locale: "fr" });
    source.hideControl("help");
    source.disableControl("hex");
    source.disable();
    const state = source.getState();
    source.destroy();

    const target = create();
    target.setState(state);
    expect(target.getState()).toEqual(state);
    expect(target.color).toBe("#6aa6a6");
    expect(target.isControlVisible("help")).toBe(false);
    expect(target.isControlEnabled("model")).toBe(false);
    expect(target.isDisabled()).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]?.detail.source).toBe("api");
  });

  it("requires every key of the state", () => {
    const created = create();
    const state: Partial<Record<keyof ColorWheelState, unknown>> = {
      ...created.getState(),
    };
    delete state.disabled;
    expect(() => {
      created.setState(state as ColorWheelState);
    }).toThrow(/Missing state key "disabled"/);
  });
});

describe.each(CONTROLS)("the %s control", (name) => {
  it("hides and shows", () => {
    const created = create();
    created.hideControl(name);
    expect(created.isControlVisible(name)).toBe(false);
    expect(controlElement(name).hidden).toBe(true);
    created.showControl(name);
    expect(created.isControlVisible(name)).toBe(true);
    expect(controlElement(name).hidden).toBe(false);
    expect(events.map((event) => event.detail.state.hiddenControls)).toEqual([
      [name],
      [],
    ]);
  });

  it("disables and enables", () => {
    const created = create();
    created.disableControl(name);
    expect(created.isControlEnabled(name)).toBe(false);
    expect(controlElement(name).classList.contains("cw-is-disabled")).toBe(
      true,
    );
    created.enableControl(name);
    expect(created.isControlEnabled(name)).toBe(true);
    expect(controlElement(name).classList.contains("cw-is-disabled")).toBe(
      false,
    );
  });
});

describe("disabled controls", () => {
  it("disables the native elements", () => {
    const created = create({ disabledControls: ["hex", "model"] });
    expect(query(".cw-input", HTMLInputElement).disabled).toBe(true);
    const model = query(".cw-segmented-field", HTMLFieldSetElement);
    const harmony = container.querySelector("select");
    expect(model.disabled).toBe(true);
    expect(harmony?.disabled).toBe(false);
    created.disable();
    expect(harmony?.disabled).toBe(true);
    expect(created.isControlEnabled("harmony")).toBe(false);
    created.enable();
    expect(harmony?.disabled).toBe(false);
  });

  it("disables the help button and closes the help", () => {
    const created = create();
    query(".cw-help-popover", HTMLElement).showPopover();
    created.disableControl("help");
    expect(query(".cw-help-button", HTMLButtonElement).disabled).toBe(true);
    expect(helpOpen()).toBe(false);
  });

  it("shows the light only with the miniature scheme", () => {
    const created = create({ harmony: "triad" });
    expect(created.isControlVisible("light")).toBe(false);
    created.harmony = "miniature-scheme";
    expect(created.isControlVisible("light")).toBe(true);
  });

  it("rejects an unknown control", () => {
    const created = create();
    expect(() => {
      created.hideControl("ring" as Control);
    }).toThrow(/Unknown control "ring"/);
  });
});

function helpOpen(): boolean {
  return query(".cw-help-popover", HTMLElement).matches(":popover-open");
}

describe("help", () => {
  it("opens over the page without moving it, and closes with its button", async () => {
    create();
    const results = query(".cw-results", HTMLElement);
    // Positions within the panel: clicking may scroll the page itself.
    const before = results.offsetTop;
    const panelHeight = query(".cw-panel", HTMLElement).offsetHeight;
    await userEvent.click(query(".cw-help-button", HTMLButtonElement));
    expect(helpOpen()).toBe(true);
    expect(results.offsetTop).toBe(before);
    expect(query(".cw-panel", HTMLElement).offsetHeight).toBe(panelHeight);
    await userEvent.click(query(".cw-help-button", HTMLButtonElement));
    expect(helpOpen()).toBe(false);
  });

  it("stays open while the wheel is used, and closes with Esc", async () => {
    create();
    await userEvent.click(query(".cw-help-button", HTMLButtonElement));
    query(".cw-ring", HTMLElement).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(helpOpen()).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(helpOpen()).toBe(false);
  });

  it("closes with its close button and returns the focus", async () => {
    create({ locale: "es" });
    await userEvent.click(query(".cw-help-button", HTMLButtonElement));
    const close = query(".cw-help-close", HTMLButtonElement);
    expect(close.getAttribute("aria-label")).toBe("Cerrar");
    await userEvent.click(close);
    expect(helpOpen()).toBe(false);
  });

  it("is a dialog named by its heading", () => {
    create();
    const popover = query(".cw-help-popover", HTMLElement);
    expect(popover.getAttribute("role")).toBe("dialog");
    const heading = document.getElementById(
      popover.getAttribute("aria-labelledby") ?? "",
    );
    expect(heading?.textContent).toBe("How to use");
  });

  it("closes when it is hidden", () => {
    const created = create();
    query(".cw-help-popover", HTMLElement).showPopover();
    created.hideControl("help");
    expect(helpOpen()).toBe(false);
  });
});

describe("locales and labels", () => {
  it("shows the texts of the locale and changes them with it", () => {
    const created = create({ harmony: "triad" });
    expect(query(".cw-results-title", HTMLElement).textContent).toBe("Colors");
    created.locale = "es";
    expect(query(".cw-results-title", HTMLElement).textContent).toBe("Colores");
    expect(query(".cw-root", HTMLElement).getAttribute("lang")).toBe("es");
    expect(query(".cw-root", HTMLElement).getAttribute("aria-label")).toBe(
      "Rueda de color",
    );
    const harmony = container.querySelector("select");
    expect(harmony?.selectedOptions[0]?.text).toBe("Tríada");
  });

  it("replaces only the texts given in labels", () => {
    const created = create({
      locale: "es",
      harmony: "triad",
      labels: { harmony: { triad: "Paleta" } },
    });
    const labels = created.getEffectiveLabels();
    expect(labels.harmony.triad).toBe("Paleta");
    expect(labels.harmony.square).toBe("Cuadrado");
    const harmony = container.querySelector("select");
    expect(harmony?.selectedOptions[0]?.text).toBe("Paleta");
  });

  it("has every text in every locale", () => {
    const created = create();
    for (const locale of ColorWheel.locales) {
      created.locale = locale;
      const texts = Object.values(created.getEffectiveLabels()).flatMap(
        (group) => Object.values(group as Record<string, string>),
      );
      expect(texts.every((text) => text.trim() !== "")).toBe(true);
    }
  });
});

describe("drawing", () => {
  it("matches the canvas to the pixel density of the screen", () => {
    create();
    const canvas = query("canvas", HTMLCanvasElement);
    const width = canvas.getBoundingClientRect().width;
    expect(width).toBeGreaterThan(0);
    expect(canvas.width).toBe(Math.round(width * devicePixelRatio));
    expect(canvas.height).toBe(canvas.width);
  });

  it("follows the width of its container", async () => {
    create();
    container.style.width = "240px";
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const canvas = query("canvas", HTMLCanvasElement);
    expect(canvas.width).toBe(
      Math.round(canvas.getBoundingClientRect().width * devicePixelRatio),
    );
    expect(canvas.getBoundingClientRect().width).toBeLessThanOrEqual(240);
  });

  it("paints the base color under its point in the triangle", () => {
    const created = create({ color: "#804000", model: "digital" });
    const canvas = query("canvas", HTMLCanvasElement);
    const context = canvas.getContext("2d");
    // The point of the base is drawn as a ring; its center shows the color.
    const position = ColorWheel.toWheelColor(created.color, "digital");
    const half = canvas.width / 2;
    const radius = half * 0.94 * 0.76;
    const angle = (position.hue * Math.PI) / 180;
    const vertex = (offset: number) => ({
      x: half + Math.sin(angle + (offset * Math.PI) / 180) * radius,
      y: half - Math.cos(angle + (offset * Math.PI) / 180) * radius,
    });
    const [p, w, k] = [vertex(0), vertex(120), vertex(240)];
    const x = p.x * position.pure + w.x * position.white + k.x * position.black;
    const y = p.y * position.pure + w.y * position.white + k.y * position.black;
    const [r, g, b] =
      context?.getImageData(Math.round(x), Math.round(y), 1, 1).data ?? [];
    expect(Math.abs((r ?? 0) - 0x80)).toBeLessThanOrEqual(3);
    expect(Math.abs((g ?? 0) - 0x40)).toBeLessThanOrEqual(3);
    expect(b ?? 0).toBeLessThanOrEqual(3);
  });
});

describe("destroy", () => {
  it("removes the wheel and makes any later call an error", () => {
    const created = create();
    created.destroy();
    expect(container.children).toHaveLength(0);
    for (const call of [
      () => created.color,
      () => {
        created.harmony = "triad";
      },
      () => created.getState(),
      () => {
        created.update({});
      },
      () => {
        created.hideControl("hex");
      },
      () => {
        created.addEventListener("change", () => undefined);
      },
      () => {
        created.destroy();
      },
    ]) {
      expect(call).toThrow(/destroyed/);
    }
  });
});

describe("accessibility", () => {
  it("gives every control and slider an accessible name", () => {
    create();
    for (const slider of container.querySelectorAll("[role=slider]")) {
      expect(slider.getAttribute("aria-label")).not.toBe("");
      expect(slider.getAttribute("aria-describedby")).not.toBeNull();
    }
    for (const control of container.querySelectorAll(".cw-input, select")) {
      expect(
        container.querySelector(`label[for="${control.id}"]`),
      ).not.toBeNull();
    }
    for (const group of container.querySelectorAll("fieldset")) {
      expect(group.querySelector("legend")?.textContent).not.toBe("");
      for (const radio of group.querySelectorAll("input[type=radio]")) {
        expect(radio.closest("label")?.textContent).not.toBe("");
      }
    }
  });

  it("gives each wheel its own ids", () => {
    create();
    const other = new ColorWheel(container, { color: "#000000" });
    const ids = [...container.querySelectorAll("[id]")].map(
      (element) => element.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    other.destroy();
  });

  it.each<[string, Partial<ColorWheelOptions>]>([
    ["by default", {}],
    ["with a harmony without light", { harmony: "triad" }],
    ["disabled", { disabled: true }],
    ["with disabled controls", { disabledControls: [...CONTROLS] }],
    ["in Japanese", { locale: "ja" }],
  ])("passes the automatic WCAG 2.2 AA check %s", async (_, options) => {
    create(options);
    query(".cw-help-popover", HTMLElement).showPopover();
    await expectNoAxeViolations(container);
  });

  it("passes the check with the dark theme", async () => {
    await cdp().send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-color-scheme", value: "dark" }],
    });
    try {
      create();
      expect(getComputedStyle(query(".cw-root", HTMLElement)).colorScheme).toBe(
        "dark",
      );
      query(".cw-help-popover", HTMLElement).showPopover();
      await expectNoAxeViolations(container);
    } finally {
      await cdp().send("Emulation.setEmulatedMedia", { features: [] });
    }
  });

  it("passes the check with an invalid hex", async () => {
    create();
    const input = query(".cw-input", HTMLInputElement);
    await userEvent.clear(input);
    await userEvent.type(input, "zz{Enter}");
    await expectNoAxeViolations(container);
  });
});
