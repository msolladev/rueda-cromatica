// Playground of the color wheel (docs/05 §8.4): `pnpm --filter
// @chromatic-wheel/color-wheel dev`. It loads the source, not the build.

import "../src/ui/style.css";
import {
  ColorWheel,
  type ColorWheelEvent,
  type ColorWheelState,
  type Control,
  type Locale,
} from "../src/index.ts";

const CONTROLS: readonly Control[] = [
  "hex",
  "model",
  "harmony",
  "light",
  "results",
  "help",
];

function byId<T extends HTMLElement>(id: string, type: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) throw new Error(`No #${id}.`);
  return element;
}

const container = byId("wheel", HTMLDivElement);
const log = byId("log", HTMLPreElement);
let saved: ColorWheelState | undefined;

function create(state?: ColorWheelState): ColorWheel {
  const wheel = new ColorWheel(container, { color: "#3daf44" });
  if (state !== undefined) wheel.setState(state);
  const write = (event: ColorWheelEvent) => {
    const { result, source } = event.detail;
    const colors = result.colors.map(({ role, hex }) => `${role} ${hex}`);
    log.textContent = `${event.type} (${source}): ${colors.join(", ")}\n${log.textContent}`;
  };
  wheel.addEventListener("input", write);
  wheel.addEventListener("change", write);
  return wheel;
}

let wheel = create();

const locale = byId("locale", HTMLSelectElement);
locale.replaceChildren(
  ...ColorWheel.locales.map((code) => new Option(code, code)),
);
locale.value = wheel.locale;
locale.addEventListener("change", () => {
  wheel.locale = locale.value as Locale;
});

byId("width", HTMLInputElement).addEventListener("input", (event) => {
  const { value } = event.target as HTMLInputElement;
  container.style.setProperty("--width", `${value}px`);
});

byId("disabled", HTMLInputElement).addEventListener("change", (event) => {
  if ((event.target as HTMLInputElement).checked) wheel.disable();
  else wheel.enable();
});

const controls = byId("controls", HTMLFieldSetElement);
for (const name of CONTROLS) {
  for (const kind of ["hidden", "disabled"] as const) {
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.addEventListener("change", () => {
      if (kind === "hidden") {
        if (box.checked) wheel.hideControl(name);
        else wheel.showControl(name);
      } else if (box.checked) wheel.disableControl(name);
      else wheel.enableControl(name);
    });
    label.append(box, ` ${name} ${kind}`);
    controls.append(label);
  }
}

byId("random", HTMLButtonElement).addEventListener("click", () => {
  const channel = () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0");
  wheel.color = `#${channel()}${channel()}${channel()}`;
});
byId("save", HTMLButtonElement).addEventListener("click", () => {
  saved = wheel.getState();
  log.textContent = `getState: ${JSON.stringify(saved)}\n${log.textContent}`;
});
byId("restore", HTMLButtonElement).addEventListener("click", () => {
  if (saved !== undefined) wheel.setState(saved);
});
byId("recreate", HTMLButtonElement).addEventListener("click", () => {
  const state = wheel.getState();
  wheel.destroy();
  wheel = create(state);
});
