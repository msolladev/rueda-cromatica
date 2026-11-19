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
import {
  createDom,
  placeIndicator,
  setOptions,
  setRadios,
  type Dom,
} from "./dom.ts";
import { drawWheel, WHEEL_SCALE } from "./draw.ts";
import { MARK_RADIUS, pointAt, RING_INNER, type Zone } from "./geometry.ts";
import { ringKey, triangleKey } from "./keyboard.ts";
import {
  colorNames,
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
import { placeMarkLabels } from "./mark-labels.ts";
import { attachPointer } from "./pointer.ts";
import {
  easeOut,
  interpolateTemplate,
  sameTemplate,
  TEMPLATE_DURATION,
} from "./template-motion.ts";

/**
 * Who caused a change: `"user"`, the person using the wheel (dragging, keys or
 * the controls), or `"api"`, the code (properties and methods). It lets a page
 * ignore the events caused by its own changes and avoid a loop.
 */
export type ChangeSource = "user" | "api";

/** The `detail` of the `input` and `change` events. */
export interface ColorWheelEventDetail {
  /** The colors after the change, as {@link ColorWheel.getResult} returns them. */
  readonly result: Result;
  /** The state after the change, as {@link ColorWheel.getState} returns it. */
  readonly state: ColorWheelState;
  /** Who caused the change. */
  readonly source: ChangeSource;
}

/** The event that the wheel emits, with its {@link ColorWheelEventDetail}. */
export type ColorWheelEvent = CustomEvent<ColorWheelEventDetail>;

/** The events of the wheel, by name. */
export interface ColorWheelEventMap {
  /**
   * Emitted continuously while the user drags on the ring or the triangle.
   * Its `source` is always `"user"`.
   */
  readonly input: ColorWheelEvent;
  /**
   * Emitted when a drag ends, and with every other change: keys, controls,
   * properties and methods. Only when the state or the result changes, and
   * never while the wheel is being created.
   */
  readonly change: ColorWheelEvent;
}

/** A listener of one of the wheel's events: a function or an object. */
export type ColorWheelListener<K extends keyof ColorWheelEventMap> =
  | ((event: ColorWheelEventMap[K]) => void)
  | {
      /** Called with each event, as with a listener function. */
      handleEvent: (event: ColorWheelEventMap[K]) => void;
    };

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
 * The color wheel component. It is created on a container, draws the wheel
 * and its controls inside it, and emits `input` and `change`
 * ({@link ColorWheelEventMap}).
 *
 * Every property can be read and assigned. Assigning one validates it and is
 * the same as calling {@link ColorWheel.update} with it. An invalid value
 * throws and changes nothing, and a value equal to the current one does not
 * emit `change`.
 *
 * After {@link ColorWheel.destroy}, every property and method throws an
 * `Error`.
 *
 * @example
 * ```ts
 * const wheel = new ColorWheel(document.querySelector("#wheel")!, {
 *   color: "#3daf44",
 *   harmony: "miniature-scheme",
 * });
 * wheel.addEventListener("change", (event) => {
 *   for (const { role, hex } of event.detail.result.colors) {
 *     console.log(role, hex);
 *   }
 * });
 * ```
 */
export class ColorWheel extends EventTarget {
  /** The included locales, the same as {@link LOCALES}. */
  static readonly locales: readonly Locale[] = LOCALES;
  /**
   * {@link compute}, for the `<script src>` file, where the global
   * `ColorWheel` is the only export.
   */
  static readonly compute = compute;
  /** {@link toWheelColor}, for the `<script src>` file. */
  static readonly toWheelColor = toWheelColor;
  /** {@link fromWheelColor}, for the `<script src>` file. */
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
  /** The template on its way to the new marks (docs/05 §6.2). */
  #motion: { from: number[]; to: number[]; start: number } | undefined;
  #motionFrame = 0;
  readonly #dom: Dom;
  readonly #abort = new AbortController();
  readonly #observer: ResizeObserver;
  /** The measured sizes of the names of the marks, until they change. */
  #markSizes: { width: number; height: number }[] | undefined;
  /** The color highlighted by the page, if any (`highlightColor`). */
  #highlighted: number | null = null;
  /** The marks under the mouse. */
  #hovered: number[] = [];

  /**
   * Creates the wheel and appends it to `container`. It does not emit
   * `change`.
   *
   * @param container - The element the wheel is drawn in. The wheel takes its
   *   width, up to `--cw-max-size`.
   * @param options - The initial properties and state of the controls. Only
   *   `color` is required.
   * @throws TypeError if `container` is not an HTML element, `options` is not
   *   an object, it has an unknown key, `color` is missing or a value has the
   *   wrong type.
   * @throws RangeError if a value is not valid, a list is empty or repeats a
   *   value, or `model` or `harmony` are not in `models` or `harmonies`.
   */
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
      placeIndicator(this.#dom.modelOptions);
      placeIndicator(this.#dom.lightOptions);
    });
    this.#observer.observe(this.#dom.canvas);
    // The pills of the segmented controls follow their size, and are placed
    // when a hidden control (the light) is shown.
    this.#observer.observe(this.#dom.modelOptions);
    this.#observer.observe(this.#dom.lightOptions);
    this.#watchPixelRatio();
    this.#render();
    this.#resize();
  }

  // Properties. Assigning one is the same as `update`.

  /**
   * The base color, as `#rrggbb` in lowercase.
   *
   * Reading it returns the base that the wheel shows. In RYB it is the color
   * the triangle reaches, which can differ from the hex assigned. Assigning
   * it accepts `#rgb` or `#rrggbb`.
   *
   * @throws TypeError if the assigned value is not a string.
   * @throws RangeError if the assigned value is not a valid hex.
   */
  get color(): string {
    this.#check();
    return this.#baseHex();
  }
  /** Same as `update({ color })`. */
  set color(value: string) {
    this.update({ color: value });
  }

  /**
   * The model the wheel computes with. Changing it keeps the base color, not
   * its position: the wheel converts to the other model the last hex it
   * received (by `color`, the hex field, `update` or `setState`), so going
   * back and forth does not lose colors that the RYB triangle cannot reach.
   * Dragging or using the keys forgets that hex.
   *
   * @defaultValue `"ryb"`, or the first of `models` if it does not include it.
   * @throws RangeError if the value is not one of {@link MODELS} or is not in
   *   `models`.
   */
  get model(): Model {
    this.#check();
    return this.#config.model;
  }
  /** Same as `update({ model })`. */
  set model(value: Model) {
    this.update({ model: value });
  }

  /**
   * The harmony whose colors the wheel computes.
   *
   * @defaultValue `"miniature-scheme"`, or the first of `harmonies` if it does
   *   not include it.
   * @throws RangeError if the value is not one of {@link HARMONIES} or is not
   *   in `harmonies`.
   */
  get harmony(): Harmony {
    this.#check();
    return this.#config.harmony;
  }
  /** Same as `update({ harmony })`. */
  set harmony(value: Harmony) {
    this.update({ harmony: value });
  }

  /**
   * The type of light of the miniature scheme. The other harmonies ignore it,
   * but it is validated and kept.
   *
   * @defaultValue `"warm"`
   * @throws RangeError if the value is not one of {@link LIGHTS}.
   */
  get light(): Light {
    this.#check();
    return this.#config.light;
  }
  /** Same as `update({ light })`. */
  set light(value: Light) {
    this.update({ light: value });
  }

  /**
   * The harmonies that the selector offers, in that order. To change it and
   * `harmony` at once, use {@link ColorWheel.update}.
   *
   * @defaultValue all of {@link HARMONIES}
   * @throws TypeError if the value is not an array.
   * @throws RangeError if it is empty, repeats or has an unknown value, or
   *   does not include the current `harmony`.
   */
  get harmonies(): readonly Harmony[] {
    this.#check();
    return [...this.#config.harmonies];
  }
  /** Same as `update({ harmonies })`. */
  set harmonies(value: readonly Harmony[]) {
    this.update({ harmonies: value });
  }

  /**
   * The models that the selector offers, in that order. To change it and
   * `model` at once, use {@link ColorWheel.update}.
   *
   * @defaultValue both of {@link MODELS}
   * @throws TypeError if the value is not an array.
   * @throws RangeError if it is empty, repeats or has an unknown value, or
   *   does not include the current `model`.
   */
  get models(): readonly Model[] {
    this.#check();
    return [...this.#config.models];
  }
  /** Same as `update({ models })`. */
  set models(value: readonly Model[]) {
    this.update({ models: value });
  }

  /**
   * The language of the texts.
   *
   * @defaultValue the first of `navigator.languages` that matches one of
   *   {@link LOCALES}, first exactly and then by base language (`pt-PT` gives
   *   `pt-BR`), or `"en"` if none matches.
   * @throws RangeError if the value is not one of {@link LOCALES}.
   */
  get locale(): Locale {
    this.#check();
    return this.#config.locale;
  }
  /** Same as `update({ locale })`. */
  set locale(value: Locale) {
    this.update({ locale: value });
  }

  /**
   * The texts that replace those of `locale`. Only the texts passed are
   * replaced; assigning it replaces the previous `labels` as a whole.
   *
   * @defaultValue `{}`
   * @throws TypeError if a group is not an object or a text is not a string.
   * @throws RangeError if a group or a key does not exist. The message names
   *   it with its full path, such as `harmony.triadd`.
   */
  get labels(): PartialLabels {
    this.#check();
    return copyLabels(this.#config.labels);
  }
  /** Same as `update({ labels })`. */
  set labels(value: PartialLabels) {
    this.update({ labels: value });
  }

  // Methods.

  /**
   * Hides a control. The ring and the triangle are the wheel and cannot be
   * hidden.
   *
   * @throws RangeError if `name` is not one of {@link CONTROLS}.
   */
  hideControl(name: Control): void {
    this.#controlMethod(name, () => this.#hidden.add(name));
  }

  /**
   * Shows a control hidden by {@link ColorWheel.hideControl}. `light` is still
   * only visible with the miniature scheme.
   *
   * @throws RangeError if `name` is not one of {@link CONTROLS}.
   */
  showControl(name: Control): void {
    this.#controlMethod(name, () => this.#hidden.delete(name));
  }

  /**
   * Whether the control is visible: not hidden and, for `light`, only with the
   * miniature scheme.
   *
   * @throws RangeError if `name` is not one of {@link CONTROLS}.
   */
  isControlVisible(name: Control): boolean {
    this.#check();
    assertControl(name);
    return this.#isVisible(name);
  }

  /**
   * Disables a control: `hex`, `model`, `harmony` and `light` disable their
   * native element, `help` disables its button and closes the help, and
   * `results` dims the swatches.
   *
   * @throws RangeError if `name` is not one of {@link CONTROLS}.
   */
  disableControl(name: Control): void {
    this.#controlMethod(name, () => this.#disabledControls.add(name));
  }

  /**
   * Enables a control disabled by {@link ColorWheel.disableControl}. It stays
   * disabled while the whole wheel is.
   *
   * @throws RangeError if `name` is not one of {@link CONTROLS}.
   */
  enableControl(name: Control): void {
    this.#controlMethod(name, () => this.#disabledControls.delete(name));
  }

  /**
   * Whether the control is enabled: neither it nor the wheel is disabled.
   *
   * @throws RangeError if `name` is not one of {@link CONTROLS}.
   */
  isControlEnabled(name: Control): boolean {
    this.#check();
    assertControl(name);
    return this.#isEnabled(name);
  }

  /**
   * Disables the whole wheel: every control, and the ring and the triangle,
   * which stop responding and leave the tab order.
   */
  disable(): void {
    this.#check();
    this.#change("api", () => {
      this.#disabled = true;
    });
  }

  /**
   * Enables the wheel disabled by {@link ColorWheel.disable}. The controls
   * disabled one by one stay disabled.
   */
  enable(): void {
    this.#check();
    this.#change("api", () => {
      this.#disabled = false;
    });
  }

  /** Whether the whole wheel is disabled. */
  isDisabled(): boolean {
    this.#check();
    return this.#disabled;
  }

  /**
   * Changes several properties at once and emits a single `change`. They are
   * validated together, so `harmonies` and `harmony` (or `models` and
   * `model`) can change in the same call. If one is not valid, none is
   * applied.
   *
   * @throws TypeError if `properties` is not an object, it has an unknown key
   *   or a value has the wrong type.
   * @throws RangeError if a value is not valid, as with each property.
   */
  update(properties: Partial<ColorWheelProperties>): void {
    this.#check();
    assertKeys(properties, PROPERTY_KEYS, "property");
    this.#apply(properties, "api");
  }

  /**
   * Returns every property and the state of the controls, to restore them
   * with {@link ColorWheel.setState}. Its `color` is the last hex received,
   * or the base shown if the wheel was moved since.
   */
  getState(): ColorWheelState {
    this.#check();
    return this.#state();
  }

  /**
   * Restores a whole state, as {@link ColorWheel.getState} returns it. Every
   * key is required. If one is not valid, nothing is applied.
   *
   * @throws TypeError if `state` is not an object, it misses or has an unknown
   *   key, or a value has the wrong type.
   * @throws RangeError if a value is not valid, as with each property.
   */
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

  /** Returns the colors the wheel shows now. */
  getResult(): Result {
    this.#check();
    return this.#result();
  }

  /**
   * Returns the texts shown: those of `locale`, with `labels` replaced. A page
   * that hides the `help` control can show these texts its own way.
   */
  getEffectiveLabels(): Labels {
    this.#check();
    return this.#labels();
  }

  /**
   * Highlights a color of the result: its mark grows and shows its name. A
   * page that shows the colors its own way (for example in tabs, with the
   * `results` control hidden) uses it to point at the one selected. It is not
   * part of the state and emits nothing. An index beyond the current colors
   * highlights nothing until there are enough.
   *
   * @param index - The position of the color in {@link ColorWheel.getResult},
   *   or `null` to highlight none.
   * @throws TypeError if `index` is not a whole number from 0, or `null`.
   */
  highlightColor(index: number | null): void {
    this.#check();
    if (index !== null && !(Number.isInteger(index) && index >= 0)) {
      throw new TypeError(
        `The index must be a whole number from 0, or null; received ${describeValue(index)}.`,
      );
    }
    if (index === this.#highlighted) return;
    this.#highlighted = index;
    this.#draw();
  }

  /** Removes the wheel and its listeners. Any later call is an error. */
  destroy(): void {
    this.#check();
    cancelAnimationFrame(this.#motionFrame);
    this.#abort.abort();
    this.#observer.disconnect();
    this.#dom.root.remove();
    this.#destroyed = true;
  }

  // Events.

  /**
   * Listens to an event of {@link ColorWheelEventMap}, with its typed
   * `detail`, or to any other event, as `EventTarget` does.
   */
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

  /** Stops listening to an event, as `EventTarget` does. */
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

  /** Dispatches an event, as `EventTarget` does. */
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
    const template = this.#template();
    const base = this.#position;
    mutate();
    this.#colors = this.#harmonize();
    this.#moveTemplate(template, base);
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

  /** The hues of the marks as drawn now, the base first. */
  #template(now = performance.now()): number[] {
    const motion = this.#motion;
    const hues = this.#colors.map((color) => color.position.hue);
    if (motion === undefined) return hues;
    const t = Math.min((now - motion.start) / TEMPLATE_DURATION, 1);
    if (t >= 1) {
      this.#motion = undefined;
      return hues;
    }
    return interpolateTemplate(motion.from, motion.to, easeOut(t));
  }

  /**
   * Starts moving the template from `from` to the current marks if the base
   * stayed where it was: a new harmony or light. When the base moves (drag,
   * keys, color, model) the triangle turns with it, and the marks follow at
   * once. Without motion if the system asks to reduce it.
   */
  #moveTemplate(from: number[], base: WheelColor): void {
    const to = this.#colors.map((color) => color.position.hue);
    const baseStayed =
      base.hue === this.#position.hue &&
      base.pure === this.#position.pure &&
      base.white === this.#position.white;
    if (
      !baseStayed ||
      sameTemplate(from, to) ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      this.#motion = undefined;
      return;
    }
    this.#motion = { from, to, start: performance.now() };
    cancelAnimationFrame(this.#motionFrame);
    const frame = () => {
      this.#draw();
      if (this.#motion !== undefined) {
        this.#motionFrame = requestAnimationFrame(frame);
      }
    };
    this.#motionFrame = requestAnimationFrame(frame);
  }

  /** Moves the base from the wheel itself: the position rules from now on. */
  #movePosition(position: WheelColor): void {
    this.#motion = undefined;
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
          dom.root.classList.add("cw-is-dragging");
          this.#hovered = [];
          (zone === "ring" ? dom.ring : dom.triangle).focus({
            preventScroll: true,
          });
        },
        move: (position) => {
          this.#movePosition(position);
          this.#emit("input", "user");
        },
        end: () => {
          dom.root.classList.remove("cw-is-dragging");
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
    const onHover = (event: PointerEvent) => {
      this.#hoverMarks(event);
    };
    dom.canvas.addEventListener("pointermove", onHover, { signal });
    dom.canvas.addEventListener("pointerleave", onHover, { signal });
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

    // The radio buttons and the select report their new value on `change`.
    const onChange = (
      control: HTMLElement,
      key: "model" | "harmony" | "light",
    ) => {
      control.addEventListener(
        "change",
        (event) => {
          const target = event.target as HTMLInputElement | HTMLSelectElement;
          this.#userControl(() => {
            this.#apply({ [key]: target.value }, "user");
          });
        },
        { signal },
      );
    };
    onChange(dom.modelOptions, "model");
    onChange(dom.harmonySelect, "harmony");
    onChange(dom.lightOptions, "light");

    // Esc closes the help, wherever the focus is, and returns the focus to
    // its button if it was inside.
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Escape" || !this.#isHelpOpen()) return;
        const focusInside = dom.helpPopover.contains(document.activeElement);
        dom.helpPopover.hidePopover();
        if (focusInside) dom.helpButton.focus();
      },
      { signal },
    );
  }

  #isHelpOpen(): boolean {
    return this.#dom.helpPopover.matches(":popover-open");
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

    dom.modelLegend.textContent = labels.control.model;
    setRadios(
      dom.modelOptions,
      `${dom.root.id}-model`,
      config.models.map((model) => [model, labels.model[model]]),
      config.model,
    );
    dom.harmonyLabel.textContent = labels.control.harmony;
    setOptions(
      dom.harmonySelect,
      config.harmonies.map((harmony) => [harmony, labels.harmony[harmony]]),
      config.harmony,
    );
    dom.lightLegend.textContent = labels.control.light;
    setRadios(
      dom.lightOptions,
      `${dom.root.id}-light`,
      (["warm", "cold"] as const).map((light) => [light, labels.light[light]]),
      config.light,
    );

    dom.resultsTitle.textContent = labels.control.results;
    const names = colorNames(this.#colors, labels);
    dom.resultsList.replaceChildren(
      ...this.#colors.map(({ hex }, index) => {
        const item = document.createElement("li");
        item.className = "cw-item";
        const swatch = document.createElement("span");
        swatch.className = "cw-swatch";
        swatch.setAttribute("aria-hidden", "true");
        swatch.style.backgroundColor = hex;
        const name = document.createElement("span");
        name.className = "cw-role";
        name.textContent = names[index] ?? "";
        const value = document.createElement("span");
        value.className = "cw-hex";
        value.textContent = hex;
        item.append(swatch, name, " ", value);
        return item;
      }),
    );

    this.#nameMarks(names);

    dom.helpTitle.textContent = labels.control.help;
    dom.helpHeading.textContent = labels.control.help;
    dom.helpClose.setAttribute("aria-label", labels.wheel.helpClose);
    dom.helpPointer.textContent = labels.wheel.pointerHelp;
    dom.helpTouch.textContent = labels.wheel.touchHelp;
    dom.helpKeyboard.textContent = labels.wheel.keyboardHelp;
    dom.helpModel.textContent = labels.wheel.modelHelp;
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
    dom.modelField.disabled = !this.#isEnabled("model");
    dom.harmonySelect.disabled = !this.#isEnabled("harmony");
    dom.lightField.disabled = !this.#isEnabled("light");
    dom.helpButton.disabled = !this.#isEnabled("help");
    if (
      (dom.helpButton.disabled || !this.#isVisible("help")) &&
      this.#isHelpOpen()
    ) {
      dom.helpPopover.hidePopover();
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
      this.#markSizes = undefined;
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
    // The canvas's `color` is `--cw-focus` resolved for the theme: the
    // variable itself may be an unresolved `light-dark()`.
    const focusColor =
      getComputedStyle(dom.canvas).color.trim() || FALLBACK_FOCUS_COLOR;
    const template = this.#template();
    drawWheel(context, {
      model: this.#config.model,
      position: this.#position,
      template,
      highlight:
        this.#motion === undefined &&
        this.#highlighted !== null &&
        this.#highlighted < template.length
          ? this.#highlighted
          : undefined,
      focus,
      focusColor,
      pixelRatio: devicePixelRatio,
    });
    this.#placeMarks(template);
  }

  /** Writes the name of each mark, if they changed, and measures them. */
  /**
   * Writes the name of each mark, with a dot of its color, rebuilding them
   * only if the names changed.
   */
  #nameMarks(names: readonly string[]): void {
    const container = this.#dom.marks;
    const current = [...container.children].map((child) => child.textContent);
    if (JSON.stringify(current) !== JSON.stringify(names)) {
      container.replaceChildren(
        ...names.map((name) => {
          const label = document.createElement("span");
          label.className = "cw-mark-label";
          const dot = document.createElement("span");
          dot.className = "cw-mark-dot";
          label.append(dot, name);
          return label;
        }),
      );
      this.#markSizes = undefined;
    }
    this.#colors.forEach((color, index) => {
      const dot = container.children[index]?.firstElementChild;
      if (dot instanceof HTMLElement) dot.style.backgroundColor = color.hex;
    });
  }

  /** The indices of the names shown: the highlighted color and those hovered. */
  #shownMarks(count: number): number[] {
    const shown = new Set(this.#hovered);
    if (this.#highlighted !== null) shown.add(this.#highlighted);
    return [...shown].filter((index) => index < count).sort((a, b) => a - b);
  }

  /**
   * Shows the names of the highlighted color and of the marks under the
   * mouse, placed on their marks (mark-labels.ts); the CSS fades them in and
   * out. While the template moves they are hidden, because a moving template
   * can have more marks than names; they appear again where it stops.
   */
  #placeMarks(template: readonly number[]): void {
    const container = this.#dom.marks;
    const labels = [...container.children] as HTMLElement[];
    const moving =
      this.#motion !== undefined || template.length !== labels.length;
    container.toggleAttribute("data-moving", moving);
    if (moving) return;
    const half = this.#dom.canvas.getBoundingClientRect().width / 2;
    if (half === 0) return;
    const sizes =
      this.#markSizes ??
      labels.map((label) => ({
        width: label.offsetWidth,
        height: label.offsetHeight,
      }));
    // Kept only once measured for real: a hidden wheel measures zero.
    if (sizes.every((size) => size.width > 0)) this.#markSizes = sizes;
    const shown = this.#shownMarks(labels.length);
    const limit = half * WHEEL_SCALE * RING_INNER - 4;
    const centers = placeMarkLabels(
      shown.map((index) => ({
        hue: template[index] ?? 0,
        width: sizes[index]?.width ?? 0,
        height: sizes[index]?.height ?? 0,
      })),
      limit,
    );
    labels.forEach((label, index) => {
      const at = shown.indexOf(index);
      label.toggleAttribute("data-shown", at !== -1);
      const center = centers[at];
      // A hidden name stays where it was, so that it fades out in place.
      if (center === undefined) return;
      label.style.translate = `calc(${String(center.x)}px - 50%) calc(${String(center.y)}px - 50%)`;
    });
  }

  /**
   * The marks under the mouse (not a finger: touch has no hover), within a
   * few pixels of their center. Overlapping marks are all hovered at once.
   */
  #hoverMarks(event: PointerEvent): void {
    let hovered: number[] = [];
    if (
      event.type === "pointermove" &&
      event.pointerType !== "touch" &&
      event.buttons === 0 &&
      this.#motion === undefined
    ) {
      const rect = this.#dom.canvas.getBoundingClientRect();
      const half = rect.width / 2;
      const radius = half * WHEEL_SCALE;
      const x = event.clientX - rect.left - half;
      const y = event.clientY - rect.top - half;
      hovered = this.#template()
        .map((hue, index) => ({ mark: pointAt(hue, MARK_RADIUS), index }))
        .filter(
          ({ mark }) =>
            Math.hypot(mark.x * radius - x, mark.y * radius - y) <=
            MARK_HOVER_RADIUS,
        )
        .map(({ index }) => index);
    }
    if (JSON.stringify(hovered) === JSON.stringify(this.#hovered)) return;
    this.#hovered = hovered;
    this.#draw();
  }
}

/** How close to a mark's center the mouse shows its name, in CSS pixels. */
const MARK_HOVER_RADIUS = 12;

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
