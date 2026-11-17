import { compute } from "../calculation/compute.ts";
import { harmonize } from "../calculation/harmonize.ts";
import { toResult, type Result } from "../calculation/result.ts";
import { DEFAULT_SETTINGS } from "../calculation/settings.ts";
import { fromWheelColor, toWheelColor } from "../color/convert.ts";
import type { Model } from "../color/model.ts";
import { formatHexColor, parseHexColor } from "../color/rgb.ts";
import type { WheelColor } from "../color/wheel-color.ts";
import { describeValue } from "../errors.ts";
import type { Harmony, PlacedColor } from "../harmony/harmony.ts";
import { LOCALES, resolveLocale, type Locale } from "../i18n/locales.ts";
import type { Light } from "../scheme/light.ts";
import { assertControl, CONTROLS, type Control } from "./controls.ts";
import { createDom, setOptions, type Dom } from "./dom.ts";
import { drawWheel } from "./draw.ts";
import type { Zone } from "./geometry.ts";
import { ringKey, triangleKey } from "./keyboard.ts";
import {
  format,
  mergeLabels,
  type Labels,
  type PartialLabels,
} from "./labels.ts";
import {
  ALL_HARMONIES,
  ALL_MODELS,
  assertKeys,
  assertProperty,
  defaultFrom,
  PROPERTY_KEYS,
  STATE_KEYS,
  type ColorWheelOptions,
  type ColorWheelProperties,
  type ColorWheelState,
} from "./options.ts";
import { attachPointer } from "./pointer.ts";

/** Who caused a change: the person using the wheel or the code. */
export type ChangeSource = "user" | "api";

export interface ColorWheelEventDetail {
  readonly result: Result;
  readonly state: ColorWheelState;
  readonly source: ChangeSource;
}

export type ColorWheelEvent = CustomEvent<ColorWheelEventDetail>;

export interface ColorWheelEventMap {
  /** Continuously while the user drags on the ring or the triangle. */
  readonly input: ColorWheelEvent;
  /** When a drag ends, and with every other change. */
  readonly change: ColorWheelEvent;
}

type ColorWheelListener<K extends keyof ColorWheelEventMap> =
  | ((event: ColorWheelEventMap[K]) => void)
  | { handleEvent: (event: ColorWheelEventMap[K]) => void };

/** The properties, without the color: what the wheel computes with. */
interface Config {
  readonly model: Model;
  readonly harmony: Harmony;
  readonly light: Light;
  readonly harmonies: readonly Harmony[];
  readonly models: readonly Model[];
  readonly locale: Locale;
  readonly labels: PartialLabels;
}

const FALLBACK_FOCUS_COLOR = "#1a5fd0";

/**
 * The color wheel component (docs/05 §6). It is created on a container,
 * draws the wheel and its controls inside it, and emits `input` and `change`.
 */
export class ColorWheel extends EventTarget {
  /** The included locales. */
  static readonly locales: readonly Locale[] = LOCALES;
  /** The calculations without the component (docs/05 §7). */
  static readonly compute = compute;
  static readonly toWheelColor = toWheelColor;
  static readonly fromWheelColor = fromWheelColor;

  #config: Config;
  #position: WheelColor;
  /** The last hex received, converted again on a model change (ADR-0021). */
  #sourceHex: string | undefined;
  #colors: PlacedColor[];
  #hidden: Set<Control>;
  #disabledControls: Set<Control>;
  #disabled: boolean;
  #destroyed = false;
  #dragSnapshot: string | undefined;
  #announceToggle = false;
  readonly #dom: Dom;
  readonly #abort = new AbortController();
  readonly #observer: ResizeObserver;

  constructor(container: HTMLElement, options: ColorWheelOptions) {
    super();
    if (!(container instanceof HTMLElement)) {
      throw new TypeError(
        `Expected the container to be an HTML element, received ${describeValue(container)}.`,
      );
    }
    assertKeys(options, STATE_KEYS, "option");
    if (!("color" in options)) {
      throw new TypeError("The color option is required.");
    }
    for (const [key, value] of Object.entries(options)) {
      assertProperty(key, value);
    }
    const harmonies = [...(options.harmonies ?? ALL_HARMONIES)];
    const models = [...(options.models ?? ALL_MODELS)];
    const config: Config = {
      model: options.model ?? defaultFrom(DEFAULT_SETTINGS.model, models),
      harmony:
        options.harmony ?? defaultFrom(DEFAULT_SETTINGS.harmony, harmonies),
      light: options.light ?? DEFAULT_SETTINGS.light,
      harmonies,
      models,
      locale: options.locale ?? resolveLocale(navigator.languages),
      labels: copyLabels(options.labels ?? {}),
    };
    assertConsistent(config);
    this.#config = config;
    this.#position = toWheelColor(options.color, config.model);
    this.#sourceHex = normalizeHex(options.color);
    this.#colors = this.#harmonize();
    this.#hidden = new Set(options.hiddenControls);
    this.#disabledControls = new Set(options.disabledControls);
    this.#disabled = options.disabled ?? false;

    this.#dom = createDom();
    container.append(this.#dom.root);
    this.#listen();
    this.#observer = new ResizeObserver(() => {
      this.#resize();
    });
    this.#observer.observe(this.#dom.canvas);
    this.#watchPixelRatio();
    this.#render();
    this.#resize();
  }

  // Properties (docs/05 §6.4). Assigning one is the same as `update`.

  /** The base the wheel shows. In RYB, the color the triangle reaches. */
  get color(): string {
    this.#check();
    return this.#baseHex();
  }
  set color(value: string) {
    this.update({ color: value });
  }

  get model(): Model {
    this.#check();
    return this.#config.model;
  }
  set model(value: Model) {
    this.update({ model: value });
  }

  get harmony(): Harmony {
    this.#check();
    return this.#config.harmony;
  }
  set harmony(value: Harmony) {
    this.update({ harmony: value });
  }

  get light(): Light {
    this.#check();
    return this.#config.light;
  }
  set light(value: Light) {
    this.update({ light: value });
  }

  get harmonies(): readonly Harmony[] {
    this.#check();
    return [...this.#config.harmonies];
  }
  set harmonies(value: readonly Harmony[]) {
    this.update({ harmonies: value });
  }

  get models(): readonly Model[] {
    this.#check();
    return [...this.#config.models];
  }
  set models(value: readonly Model[]) {
    this.update({ models: value });
  }

  get locale(): Locale {
    this.#check();
    return this.#config.locale;
  }
  set locale(value: Locale) {
    this.update({ locale: value });
  }

  get labels(): PartialLabels {
    this.#check();
    return copyLabels(this.#config.labels);
  }
  set labels(value: PartialLabels) {
    this.update({ labels: value });
  }

  // Methods (docs/05 §6.5).

  hideControl(name: Control): void {
    this.#controlMethod(name, () => this.#hidden.add(name));
  }

  showControl(name: Control): void {
    this.#controlMethod(name, () => this.#hidden.delete(name));
  }

  /**
   * Whether the control is visible: not hidden and, for `light`, only with the
   * miniature scheme.
   */
  isControlVisible(name: Control): boolean {
    this.#check();
    assertControl(name);
    return this.#isVisible(name);
  }

  disableControl(name: Control): void {
    this.#controlMethod(name, () => this.#disabledControls.add(name));
  }

  enableControl(name: Control): void {
    this.#controlMethod(name, () => this.#disabledControls.delete(name));
  }

  /** Whether the control is enabled: neither it nor the wheel is disabled. */
  isControlEnabled(name: Control): boolean {
    this.#check();
    assertControl(name);
    return this.#isEnabled(name);
  }

  disable(): void {
    this.#check();
    this.#change("api", () => {
      this.#disabled = true;
    });
  }

  enable(): void {
    this.#check();
    this.#change("api", () => {
      this.#disabled = false;
    });
  }

  isDisabled(): boolean {
    this.#check();
    return this.#disabled;
  }

  /** Changes several properties at once and emits a single `change`. */
  update(properties: Partial<ColorWheelProperties>): void {
    this.#check();
    assertKeys(properties, PROPERTY_KEYS, "property");
    this.#apply(properties, "api");
  }

  getState(): ColorWheelState {
    this.#check();
    return this.#state();
  }

  /** Restores a whole state, as `getState` returns it. */
  setState(state: ColorWheelState): void {
    this.#check();
    assertKeys(state, STATE_KEYS, "state");
    for (const key of STATE_KEYS) {
      if (!(key in state)) {
        throw new TypeError(`Missing state key ${JSON.stringify(key)}.`);
      }
    }
    for (const key of ["hiddenControls", "disabledControls", "disabled"]) {
      assertProperty(key, state[key as keyof ColorWheelState]);
    }
    const { hiddenControls, disabledControls, disabled, ...properties } = state;
    this.#apply(properties, "api", () => {
      this.#hidden = new Set(hiddenControls);
      this.#disabledControls = new Set(disabledControls);
      this.#disabled = disabled;
    });
  }

  getResult(): Result {
    this.#check();
    return this.#result();
  }

  /** The texts shown: those of the locale, with `labels` replaced. */
  getEffectiveLabels(): Labels {
    this.#check();
    return this.#labels();
  }

  /** Removes the wheel and its listeners. Any later call is an error. */
  destroy(): void {
    this.#check();
    this.#abort.abort();
    this.#observer.disconnect();
    this.#dom.root.remove();
    this.#destroyed = true;
  }

  // Events (docs/05 §6.6).

  override addEventListener<K extends keyof ColorWheelEventMap>(
    type: K,
    listener: ColorWheelListener<K> | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    this.#check();
    super.addEventListener(type, listener, options);
  }

  override removeEventListener<K extends keyof ColorWheelEventMap>(
    type: K,
    listener: ColorWheelListener<K> | null,
    options?: boolean | EventListenerOptions,
  ): void;
  override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void;
  override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    this.#check();
    super.removeEventListener(type, listener, options);
  }

  override dispatchEvent(event: Event): boolean {
    this.#check();
    return super.dispatchEvent(event);
  }

  // Internals.

  #check(): void {
    if (this.#destroyed) {
      throw new Error("This ColorWheel was destroyed. Create a new one.");
    }
  }

  #baseHex(): string {
    return (
      this.#colors[0]?.hex ?? fromWheelColor(this.#position, this.#config.model)
    );
  }

  #harmonize(): PlacedColor[] {
    const { model, harmony, light } = this.#config;
    return harmonize({ color: this.#position, model, harmony, light });
  }

  #result(): Result {
    const { model, harmony, light } = this.#config;
    return toResult({ model, harmony, light }, this.#colors);
  }

  #labels(): Labels {
    return mergeLabels(this.#config.locale, this.#config.labels);
  }

  #state(): ColorWheelState {
    const config = this.#config;
    return {
      color: this.#sourceHex ?? this.#baseHex(),
      model: config.model,
      harmony: config.harmony,
      light: config.light,
      harmonies: [...config.harmonies],
      models: [...config.models],
      locale: config.locale,
      labels: copyLabels(config.labels),
      hiddenControls: CONTROLS.filter((name) => this.#hidden.has(name)),
      disabledControls: CONTROLS.filter((name) =>
        this.#disabledControls.has(name),
      ),
      disabled: this.#disabled,
    };
  }

  #snapshot(): string {
    return JSON.stringify([this.#state(), this.#result()]);
  }

  #isVisible(name: Control): boolean {
    if (this.#hidden.has(name)) return false;
    return name !== "light" || this.#config.harmony === "miniature-scheme";
  }

  #isEnabled(name: Control): boolean {
    return !this.#disabled && !this.#disabledControls.has(name);
  }

  #controlMethod(name: Control, mutate: () => void): void {
    this.#check();
    assertControl(name);
    this.#change("api", mutate);
  }

  /** The hue that keeps the same color in `model`, for colors without hue. */
  #hueIn(model: Model): number {
    const { hue } = this.#position;
    if (model === this.#config.model) return hue;
    const pure = { hue, pure: 1, white: 0, black: 0 };
    return toWheelColor(fromWheelColor(pure, this.#config.model), model).hue;
  }

  /**
   * Validates and applies properties, all or none. A new model keeps the base
   * color, converted from the last hex received (ADR-0021).
   */
  #apply(
    properties: Readonly<Record<string, unknown>>,
    source: ChangeSource,
    alsoMutate?: () => void,
  ): void {
    for (const [key, value] of Object.entries(properties)) {
      assertProperty(key, value);
    }
    const update = properties as Partial<ColorWheelProperties>;
    const current = this.#config;
    const next: Config = {
      model: update.model ?? current.model,
      harmony: update.harmony ?? current.harmony,
      light: update.light ?? current.light,
      harmonies: [...(update.harmonies ?? current.harmonies)],
      models: [...(update.models ?? current.models)],
      locale: update.locale ?? current.locale,
      labels: copyLabels(update.labels ?? current.labels),
    };
    assertConsistent(next);

    let position = this.#position;
    let sourceHex = this.#sourceHex;
    if (update.color !== undefined) {
      position = toWheelColor(
        update.color,
        next.model,
        this.#hueIn(next.model),
      );
      sourceHex = normalizeHex(update.color);
    } else if (next.model !== current.model) {
      const hex = sourceHex ?? this.#baseHex();
      position = toWheelColor(hex, next.model, this.#hueIn(next.model));
    }

    this.#change(source, () => {
      this.#config = next;
      this.#position = position;
      this.#sourceHex = sourceHex;
      alsoMutate?.();
    });
  }

  /** Mutates, renders, and emits `change` if the state or result changed. */
  #change(source: ChangeSource, mutate: () => void): boolean {
    const before = this.#snapshot();
    mutate();
    this.#colors = this.#harmonize();
    this.#render();
    if (this.#snapshot() === before) return false;
    this.#emit("change", source);
    return true;
  }

  #emit(type: keyof ColorWheelEventMap, source: ChangeSource): void {
    const detail: ColorWheelEventDetail = {
      result: this.#result(),
      state: this.#state(),
      source,
    };
    super.dispatchEvent(new CustomEvent(type, { detail }));
  }

  /** Moves the base from the wheel itself: the position rules from now on. */
  #movePosition(position: WheelColor): void {
    this.#position = position;
    this.#sourceHex = undefined;
    this.#colors = this.#harmonize();
    this.#render();
  }

  #listen(): void {
    const { signal } = this.#abort;
    const dom = this.#dom;

    attachPointer(
      dom.canvas,
      {
        enabled: () => !this.#disabled,
        position: () => this.#position,
        start: (zone) => {
          this.#dragSnapshot = this.#snapshot();
          (zone === "ring" ? dom.ring : dom.triangle).focus({
            preventScroll: true,
          });
        },
        move: (position) => {
          this.#movePosition(position);
          this.#emit("input", "user");
        },
        end: () => {
          const before = this.#dragSnapshot;
          this.#dragSnapshot = undefined;
          if (before !== undefined && before !== this.#snapshot()) {
            this.#emit("change", "user");
          }
        },
      },
      signal,
    );

    const onKey = (zone: Zone) => (event: KeyboardEvent) => {
      if (this.#disabled || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const position = this.#position;
      let next: WheelColor | undefined;
      if (zone === "ring") {
        const hue = ringKey(position.hue, event);
        if (hue !== undefined) next = { ...position, hue };
      } else {
        const proportions = triangleKey(position, event);
        if (proportions !== undefined)
          next = { hue: position.hue, ...proportions };
      }
      if (next === undefined) return;
      event.preventDefault();
      const moved = next;
      this.#change("user", () => {
        this.#position = moved;
        this.#sourceHex = undefined;
      });
    };
    dom.ring.addEventListener("keydown", onKey("ring"), { signal });
    dom.triangle.addEventListener("keydown", onKey("triangle"), { signal });
    for (const slider of [dom.ring, dom.triangle]) {
      slider.addEventListener(
        "focus",
        () => {
          this.#draw();
        },
        { signal },
      );
      slider.addEventListener(
        "blur",
        () => {
          this.#draw();
        },
        { signal },
      );
    }

    dom.hexInput.addEventListener(
      "change",
      () => {
        const value = dom.hexInput.value.trim();
        const hex = value.startsWith("#") ? value : `#${value}`;
        try {
          parseHexColor(hex);
        } catch {
          dom.hexInput.setAttribute("aria-invalid", "true");
          dom.hexError.hidden = false;
          return;
        }
        this.#clearHexError();
        this.#userControl(() => {
          this.#apply({ color: hex }, "user");
        });
        dom.hexInput.value = this.#baseHex();
      },
      { signal },
    );

    const onSelect = (
      control: HTMLSelectElement,
      key: "model" | "harmony" | "light",
    ) => {
      control.addEventListener(
        "change",
        () => {
          this.#userControl(() => {
            this.#apply({ [key]: control.value }, "user");
          });
        },
        { signal },
      );
    };
    onSelect(dom.modelSelect, "model");
    onSelect(dom.harmonySelect, "harmony");
    onSelect(dom.lightSelect, "light");

    dom.helpSummary.addEventListener(
      "click",
      (event) => {
        if (!this.#isEnabled("help")) event.preventDefault();
      },
      { signal },
    );
  }

  /** A change from a control: announced when it changes the colors. */
  #userControl(apply: () => void): void {
    const before = JSON.stringify(this.#result());
    apply();
    if (JSON.stringify(this.#result()) === before) return;
    const labels = this.#labels();
    this.#announce(
      format(labels.wheel.resultsUpdated, {
        count: this.#colors.length,
        harmony: labels.harmony[this.#config.harmony],
      }),
    );
  }

  #announce(text: string): void {
    // A trailing space makes a repeated message a new one for screen readers.
    this.#announceToggle = !this.#announceToggle;
    this.#dom.status.textContent = this.#announceToggle
      ? text
      : `${text}\u00a0`;
  }

  #clearHexError(): void {
    this.#dom.hexInput.removeAttribute("aria-invalid");
    this.#dom.hexError.hidden = true;
  }

  #render(): void {
    const dom = this.#dom;
    const labels = this.#labels();
    const config = this.#config;
    const { hue, pure, white } = this.#position;

    dom.root.setAttribute("aria-label", labels.wheel.label);
    dom.root.lang = config.locale;
    dom.root.classList.toggle("cw-is-disabled", this.#disabled);

    const sliderEnabled = !this.#disabled;
    dom.ring.setAttribute("aria-label", labels.wheel.ring);
    dom.ring.setAttribute("aria-valuenow", String(Math.round(hue) % 360));
    dom.ring.setAttribute(
      "aria-valuetext",
      format(labels.wheel.ringValue, { hue: Math.round(hue) % 360 }),
    );
    const percents = percentages(pure, white);
    dom.triangle.setAttribute("aria-label", labels.wheel.triangle);
    dom.triangle.setAttribute("aria-valuenow", String(percents.pure));
    dom.triangle.setAttribute(
      "aria-valuetext",
      format(labels.wheel.triangleValue, percents),
    );
    for (const slider of [dom.ring, dom.triangle]) {
      slider.tabIndex = sliderEnabled ? 0 : -1;
      if (sliderEnabled) slider.removeAttribute("aria-disabled");
      else slider.setAttribute("aria-disabled", "true");
    }

    dom.hexLabel.textContent = labels.control.hex;
    dom.hexError.textContent = labels.wheel.hexInvalid;
    dom.hexInput.setAttribute("aria-describedby", dom.hexError.id);
    if (document.activeElement !== dom.hexInput) {
      dom.hexInput.value = this.#baseHex();
      this.#clearHexError();
    }

    dom.modelLabel.textContent = labels.control.model;
    setOptions(
      dom.modelSelect,
      config.models.map((model) => [model, labels.model[model]]),
      config.model,
    );
    dom.harmonyLabel.textContent = labels.control.harmony;
    setOptions(
      dom.harmonySelect,
      config.harmonies.map((harmony) => [harmony, labels.harmony[harmony]]),
      config.harmony,
    );
    dom.lightLabel.textContent = labels.control.light;
    setOptions(
      dom.lightSelect,
      (["warm", "cold"] as const).map((light) => [light, labels.light[light]]),
      config.light,
    );

    dom.resultsTitle.textContent = labels.control.results;
    dom.resultsList.replaceChildren(
      ...this.#colors.map(({ role, hex }) => {
        const item = document.createElement("li");
        item.className = "cw-item";
        const swatch = document.createElement("span");
        swatch.className = "cw-swatch";
        swatch.setAttribute("aria-hidden", "true");
        swatch.style.backgroundColor = hex;
        const name = document.createElement("span");
        name.className = "cw-role";
        name.textContent = labels.role[role];
        const value = document.createElement("span");
        value.className = "cw-hex";
        value.textContent = hex;
        item.append(swatch, name, " ", value);
        return item;
      }),
    );

    dom.helpSummary.textContent = labels.control.help;
    dom.helpPointer.textContent = labels.wheel.pointerHelp;
    dom.helpTouch.textContent = labels.wheel.touchHelp;
    dom.helpKeyboard.textContent = labels.wheel.keyboardHelp;
    dom.ringKeys.textContent = labels.wheel.ringKeys;
    dom.triangleKeys.textContent = labels.wheel.triangleKeys;

    const fields: Readonly<Record<Control, HTMLElement>> = {
      hex: dom.hexField,
      model: dom.modelField,
      harmony: dom.harmonyField,
      light: dom.lightField,
      results: dom.results,
      help: dom.help,
    };
    for (const name of CONTROLS) {
      const enabled = this.#isEnabled(name);
      fields[name].hidden = !this.#isVisible(name);
      fields[name].classList.toggle("cw-is-disabled", !enabled);
    }
    dom.hexInput.disabled = !this.#isEnabled("hex");
    dom.modelSelect.disabled = !this.#isEnabled("model");
    dom.harmonySelect.disabled = !this.#isEnabled("harmony");
    dom.lightSelect.disabled = !this.#isEnabled("light");
    const helpEnabled = this.#isEnabled("help");
    dom.helpSummary.tabIndex = helpEnabled ? 0 : -1;
    if (helpEnabled) dom.helpSummary.removeAttribute("aria-disabled");
    else {
      dom.helpSummary.setAttribute("aria-disabled", "true");
      dom.help.open = false;
    }

    this.#draw();
  }

  #resize(): void {
    if (this.#destroyed) return;
    const canvas = this.#dom.canvas;
    const size = Math.round(
      canvas.getBoundingClientRect().width * devicePixelRatio,
    );
    if (canvas.width !== size || canvas.height !== size) {
      canvas.width = size;
      canvas.height = size;
    }
    this.#draw();
  }

  /** Redraws on a change of pixel density, such as another screen or zoom. */
  #watchPixelRatio(): void {
    const query = matchMedia(`(resolution: ${String(devicePixelRatio)}dppx)`);
    query.addEventListener(
      "change",
      () => {
        if (this.#destroyed) return;
        this.#resize();
        this.#watchPixelRatio();
      },
      { once: true, signal: this.#abort.signal },
    );
  }

  #draw(): void {
    const dom = this.#dom;
    const context = dom.canvas.getContext("2d");
    if (context === null || dom.canvas.width === 0) return;
    const focus: Zone | undefined = dom.ring.matches(":focus-visible")
      ? "ring"
      : dom.triangle.matches(":focus-visible")
        ? "triangle"
        : undefined;
    const focusColor =
      getComputedStyle(dom.root).getPropertyValue("--cw-focus").trim() ||
      FALLBACK_FOCUS_COLOR;
    drawWheel(context, {
      model: this.#config.model,
      position: this.#position,
      colors: this.#colors,
      focus,
      focusColor,
      pixelRatio: devicePixelRatio,
    });
  }
}

function assertConsistent(config: Config): void {
  if (!config.models.includes(config.model)) {
    throw new RangeError(
      `The model ${JSON.stringify(config.model)} is not in models.`,
    );
  }
  if (!config.harmonies.includes(config.harmony)) {
    throw new RangeError(
      `The harmony ${JSON.stringify(config.harmony)} is not in harmonies.`,
    );
  }
}

function normalizeHex(hex: string): string {
  return formatHexColor(parseHexColor(hex));
}

function copyLabels(labels: PartialLabels): PartialLabels {
  return Object.fromEntries(
    Object.entries(labels).map(([group, texts]) => [group, { ...texts }]),
  );
}

/** Whole percentages that add up to 100, for the triangle's value text. */
function percentages(
  pure: number,
  white: number,
): { pure: number; white: number; black: number } {
  const p = Math.round(pure * 100);
  const w = Math.round(white * 100);
  return { pure: p, white: w, black: Math.max(0, 100 - p - w) };
}
