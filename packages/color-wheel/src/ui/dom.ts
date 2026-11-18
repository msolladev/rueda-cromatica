// The markup of the component: native, semantic HTML, the same at every size
// (docs/05 §6.2). The texts and values are filled in by `ColorWheel`.

import { closeIcon, helpIcon } from "./icons.ts";

let instances = 0;

export interface Dom {
  readonly root: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  readonly ring: HTMLDivElement;
  readonly triangle: HTMLDivElement;
  readonly hexField: HTMLDivElement;
  readonly hexLabel: HTMLLabelElement;
  readonly hexInput: HTMLInputElement;
  readonly hexError: HTMLParagraphElement;
  readonly modelField: HTMLFieldSetElement;
  readonly modelLegend: HTMLLegendElement;
  readonly modelOptions: HTMLDivElement;
  readonly harmonyField: HTMLDivElement;
  readonly harmonyLabel: HTMLLabelElement;
  readonly harmonySelect: HTMLSelectElement;
  readonly lightField: HTMLFieldSetElement;
  readonly lightLegend: HTMLLegendElement;
  readonly lightOptions: HTMLDivElement;
  readonly results: HTMLElement;
  readonly resultsTitle: HTMLParagraphElement;
  readonly resultsList: HTMLOListElement;
  readonly help: HTMLDivElement;
  readonly helpButton: HTMLButtonElement;
  readonly helpTitle: HTMLSpanElement;
  readonly helpPopover: HTMLDivElement;
  readonly helpHeading: HTMLParagraphElement;
  readonly helpClose: HTMLButtonElement;
  readonly helpPointer: HTMLParagraphElement;
  readonly helpTouch: HTMLParagraphElement;
  readonly helpKeyboard: HTMLParagraphElement;
  readonly ringKeys: HTMLLIElement;
  readonly triangleKeys: HTMLLIElement;
  readonly status: HTMLDivElement;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  parent?.append(node);
  return node;
}

function field(
  parent: HTMLElement,
  id: string,
): {
  field: HTMLDivElement;
  label: HTMLLabelElement;
} {
  const container = element("div", "cw-field", parent);
  const label = element("label", "cw-label", container);
  label.htmlFor = id;
  return { field: container, label };
}

/**
 * A segmented control: a group of native radio buttons, for the controls with
 * only a few options (docs/05 §6.3).
 */
function segmented(parent: HTMLElement) {
  const container = element("fieldset", "cw-field cw-segmented-field", parent);
  const legend = element("legend", "cw-label", container);
  const options = element("div", "cw-segmented", container);
  return { field: container, legend, options };
}

function select(parent: HTMLElement, id: string) {
  const { field: container, label } = field(parent, id);
  // The box draws the chevron next to the select (style.css).
  const box = element("span", "cw-select-box", container);
  const control = element("select", "cw-select", box);
  control.id = id;
  return { field: container, label, select: control };
}

export function createDom(): Dom {
  instances += 1;
  const id = (name: string) => `cw-${String(instances)}-${name}`;

  const root = element("div", "cw-root");
  root.id = id("root");
  root.setAttribute("role", "group");

  const layout = element("div", "cw-layout", root);
  const wheel = element("div", "cw-wheel", layout);
  const canvas = element("canvas", "cw-canvas", wheel);
  canvas.setAttribute("aria-hidden", "true");
  const ring = element("div", "cw-ring", wheel);
  const triangle = element("div", "cw-triangle", wheel);
  for (const slider of [ring, triangle]) {
    slider.setAttribute("role", "slider");
    slider.tabIndex = 0;
  }
  ring.setAttribute("aria-valuemin", "0");
  ring.setAttribute("aria-valuemax", "359");
  triangle.setAttribute("aria-valuemin", "0");
  triangle.setAttribute("aria-valuemax", "100");

  const panel = element("div", "cw-panel", layout);
  const controls = element("div", "cw-controls", panel);

  const hex = field(controls, id("hex"));
  const hexInput = element("input", "cw-input", hex.field);
  hexInput.id = id("hex");
  hexInput.type = "text";
  hexInput.autocomplete = "off";
  hexInput.spellcheck = false;
  hexInput.maxLength = 7;
  hexInput.setAttribute("autocapitalize", "off");
  const hexError = element("p", "cw-error", hex.field);
  hexError.id = id("hex-error");
  hexError.hidden = true;

  const model = segmented(controls);
  const harmony = select(controls, id("harmony"));
  harmony.field.classList.add("cw-field-wide");
  const light = segmented(controls);
  light.field.classList.add("cw-field-wide");

  const results = element("section", "cw-results", panel);
  const resultsTitle = element("p", "cw-results-title", results);
  resultsTitle.id = id("results");
  results.setAttribute("aria-labelledby", resultsTitle.id);
  const resultsList = element("ol", "cw-list", results);
  // Safari drops the list semantics of a list without bullets.
  resultsList.setAttribute("role", "list");

  // The help opens in a popover anchored to its button: it floats over the
  // page instead of pushing it down (docs/05 §6.3). It is "manual" so that it
  // stays open while the user tries the wheel.
  const help = element("div", "cw-help", panel);
  const helpButton = element("button", "cw-help-button", help);
  helpButton.type = "button";
  helpButton.append(helpIcon());
  const helpTitle = element("span", "", helpButton);
  const helpPopover = element("div", "cw-help-popover", help);
  helpPopover.id = id("help");
  helpPopover.setAttribute("popover", "manual");
  helpPopover.setAttribute("role", "dialog");
  helpButton.setAttribute("popovertarget", helpPopover.id);
  // Each wheel anchors its popover to its own help block, which is as wide as
  // the controls, so that the popover takes that same width.
  const anchor = `--${id("help-anchor")}`;
  help.style.setProperty("anchor-name", anchor);
  helpPopover.style.setProperty("position-anchor", anchor);
  const helpHeader = element("div", "cw-help-header", helpPopover);
  const helpHeading = element("p", "cw-help-heading", helpHeader);
  helpHeading.id = id("help-heading");
  helpPopover.setAttribute("aria-labelledby", helpHeading.id);
  const helpClose = element("button", "cw-help-close", helpHeader);
  helpClose.type = "button";
  helpClose.setAttribute("popovertarget", helpPopover.id);
  helpClose.setAttribute("popovertargetaction", "hide");
  helpClose.append(closeIcon());
  const helpBody = element("div", "cw-help-body", helpPopover);
  const helpPointer = element("p", "cw-help-text", helpBody);
  const helpTouch = element("p", "cw-help-text", helpBody);
  const helpKeyboard = element("p", "cw-help-text", helpBody);
  const keys = element("ul", "cw-help-keys", helpBody);
  const ringKeys = element("li", "", keys);
  ringKeys.id = id("ring-keys");
  const triangleKeys = element("li", "", keys);
  triangleKeys.id = id("triangle-keys");
  ring.setAttribute("aria-describedby", ringKeys.id);
  triangle.setAttribute("aria-describedby", triangleKeys.id);

  const status = element("div", "cw-visually-hidden", root);
  status.setAttribute("role", "status");

  return {
    root,
    canvas,
    ring,
    triangle,
    hexField: hex.field,
    hexLabel: hex.label,
    hexInput,
    hexError,
    modelField: model.field,
    modelLegend: model.legend,
    modelOptions: model.options,
    harmonyField: harmony.field,
    harmonyLabel: harmony.label,
    harmonySelect: harmony.select,
    lightField: light.field,
    lightLegend: light.legend,
    lightOptions: light.options,
    results,
    resultsTitle,
    resultsList,
    help,
    helpButton,
    helpTitle,
    helpPopover,
    helpHeading,
    helpClose,
    helpPointer,
    helpTouch,
    helpKeyboard,
    ringKeys,
    triangleKeys,
    status,
  };
}

/** Replaces the options of `select` if they changed, and selects `value`. */
export function setOptions(
  control: HTMLSelectElement,
  options: readonly (readonly [value: string, text: string])[],
  value: string,
): void {
  const current = [...control.options].map((option) => [
    option.value,
    option.text,
  ]);
  if (JSON.stringify(current) !== JSON.stringify(options)) {
    control.replaceChildren(
      ...options.map(([optionValue, text]) => new Option(text, optionValue)),
    );
  }
  control.value = value;
}

/**
 * Replaces the radio buttons of a segmented control if they changed, and
 * checks `value`. `name` groups them, so that the arrows move between them.
 */
export function setRadios(
  container: HTMLElement,
  name: string,
  options: readonly (readonly [value: string, text: string])[],
  value: string,
): void {
  const inputs = () => [...container.querySelectorAll("input")];
  const current = inputs().map((input) => [
    input.value,
    input.parentElement?.textContent ?? "",
  ]);
  if (JSON.stringify(current) !== JSON.stringify(options)) {
    container.replaceChildren(
      ...options.map(([optionValue, text]) => {
        const label = document.createElement("label");
        label.className = "cw-segment";
        const input = document.createElement("input");
        input.className = "cw-segment-input";
        input.type = "radio";
        input.name = name;
        input.value = optionValue;
        label.append(input, text);
        return label;
      }),
    );
  }
  for (const input of inputs()) input.checked = input.value === value;
  placeIndicator(container);
}

/**
 * Places the pill of a segmented control under its checked option (docs/05
 * §6.3): writes its measured place on `--cw-indicator-*` and marks the
 * control with `data-indicator`, and the CSS slides a single pill there with
 * a transition, in every browser. A hidden control measures nothing and keeps
 * its last place until it is shown and measured again.
 */
export function placeIndicator(container: HTMLElement): void {
  const checked = container.querySelector("input:checked")?.parentElement;
  if (!(checked instanceof HTMLElement) || checked.offsetWidth === 0) return;
  const place = {
    x: checked.offsetLeft,
    y: checked.offsetTop,
    w: checked.offsetWidth,
    h: checked.offsetHeight,
  };
  for (const [name, size] of Object.entries(place)) {
    container.style.setProperty(`--cw-indicator-${name}`, `${String(size)}px`);
  }
  container.dataset["indicator"] = "";
}
