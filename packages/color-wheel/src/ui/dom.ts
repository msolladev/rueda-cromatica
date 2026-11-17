// The markup of the component: native, semantic HTML, the same at every size
// (docs/05 §6.2). The texts and values are filled in by `ColorWheel`.

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
  readonly modelField: HTMLDivElement;
  readonly modelLabel: HTMLLabelElement;
  readonly modelSelect: HTMLSelectElement;
  readonly harmonyField: HTMLDivElement;
  readonly harmonyLabel: HTMLLabelElement;
  readonly harmonySelect: HTMLSelectElement;
  readonly lightField: HTMLDivElement;
  readonly lightLabel: HTMLLabelElement;
  readonly lightSelect: HTMLSelectElement;
  readonly results: HTMLElement;
  readonly resultsTitle: HTMLParagraphElement;
  readonly resultsList: HTMLOListElement;
  readonly help: HTMLDetailsElement;
  readonly helpSummary: HTMLElement;
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

function select(parent: HTMLElement, id: string) {
  const { field: container, label } = field(parent, id);
  const control = element("select", "cw-select", container);
  control.id = id;
  return { field: container, label, select: control };
}

export function createDom(): Dom {
  instances += 1;
  const id = (name: string) => `cw-${String(instances)}-${name}`;

  const root = element("div", "cw-root");
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

  const model = select(controls, id("model"));
  const harmony = select(controls, id("harmony"));
  harmony.field.classList.add("cw-field-wide");
  const light = select(controls, id("light"));

  const results = element("section", "cw-results", panel);
  const resultsTitle = element("p", "cw-results-title", results);
  resultsTitle.id = id("results");
  results.setAttribute("aria-labelledby", resultsTitle.id);
  const resultsList = element("ol", "cw-list", results);
  // Safari drops the list semantics of a list without bullets.
  resultsList.setAttribute("role", "list");

  const help = element("details", "cw-help", panel);
  const helpSummary = element("summary", "cw-help-summary", help);
  const helpBody = element("div", "cw-help-body", help);
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
    modelLabel: model.label,
    modelSelect: model.select,
    harmonyField: harmony.field,
    harmonyLabel: harmony.label,
    harmonySelect: harmony.select,
    lightField: light.field,
    lightLabel: light.label,
    lightSelect: light.select,
    results,
    resultsTitle,
    resultsList,
    help,
    helpSummary,
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
