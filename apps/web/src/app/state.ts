/**
 * The state of the screen and its rules (docs/07 §5), as a pure reducer
 * without React: React only dispatches actions and draws.
 */
import type {
  Harmony,
  Light,
  Locale,
  Model,
} from "@chromatic-wheel/color-wheel";
import {
  DEFAULT_LIMIT,
  DEFAULT_PAINT_TYPES,
  paintTypeSchema,
  type PaintType,
} from "@chromatic-wheel/domain";
import type { Theme } from "../features/theme/theme.ts";

/** The types that are not candidates by default, which the user can add. */
export const EXTRA_PAINT_TYPES: readonly PaintType[] = Object.freeze(
  paintTypeSchema.options.filter((type) => !DEFAULT_PAINT_TYPES.includes(type)),
);

/** How the results are shown: by brand or the closest of all brands. */
export type View = "by-brand" | "overall";

/** The key of «See more» for the closest of all brands. */
export const OVERALL = "overall";

export interface Filters {
  /**
   * The brands the user turned off. Stored this way so that a brand added to
   * the catalog later is shown by default.
   */
  readonly excludedBrands: readonly string[];
  /** Types added to the default ones ({@link EXTRA_PAINT_TYPES}). */
  readonly extraTypes: readonly PaintType[];
  readonly includeMetallic: boolean;
  readonly includeDiscontinued: boolean;
}

/** What is restored of the wheel (docs/07 §6). */
export interface WheelPreferences {
  readonly color: string;
  readonly model: Model;
  readonly harmony: Harmony;
  readonly light: Light;
}

/**
 * The paint the base was chosen from in the search (docs/07 §15), with its
 * hex: the base is that paint while the wheel's color is that hex.
 */
export interface ChosenPaint {
  readonly id: string;
  readonly hex: string;
}

/** What is kept between visits (docs/07 §6). */
export interface Preferences {
  readonly filters: Filters;
  readonly view: View;
  readonly theme: Theme;
  /** The language chosen in the selector; `null` until one is chosen. */
  readonly locale: Locale | null;
  readonly installDismissed: boolean;
  /** `null` until the wheel changes for the first time. */
  readonly wheel: WheelPreferences | null;
  /** The paint the base comes from, while it is the base. */
  readonly paint: ChosenPaint | null;
}

export interface ScreenState {
  readonly preferences: Preferences;
  /**
   * Whether the saved preferences were read. Until then nothing is saved,
   * so that the defaults never overwrite them.
   */
  readonly restored: boolean;
  /** The saved wheel, to apply once to the wheel when it is read. */
  readonly restoredWheel: WheelPreferences | null;
  /** The selected color tab. */
  readonly tab: number;
  /** Results asked for with «See more», by brand ID or {@link OVERALL}. */
  readonly more: Readonly<Record<string, number>>;
  /**
   * The paint the base came from until the wheel moved, for «Back to…»
   * (docs/07 §15). Only for this visit.
   */
  readonly previousPaint: ChosenPaint | null;
}

export type Action =
  /** The saved preferences were read: `null` if there were none. */
  | { readonly type: "restore"; readonly preferences: Preferences | null }
  | { readonly type: "toggle-brand"; readonly brandId: string }
  | { readonly type: "toggle-type"; readonly paintType: PaintType }
  | { readonly type: "set-metallic"; readonly value: boolean }
  | { readonly type: "set-discontinued"; readonly value: boolean }
  | { readonly type: "set-view"; readonly view: View }
  | { readonly type: "select-tab"; readonly index: number }
  | { readonly type: "show-more"; readonly key: string }
  /** Back to the first results of a key of «See more». */
  | { readonly type: "show-less"; readonly key: string }
  | { readonly type: "colors-changed"; readonly count: number }
  | { readonly type: "wheel-changed"; readonly wheel: WheelPreferences }
  /**
   * A paint becomes the base; the wheel is told apart. From an official
   * equivalence, the paint it comes from is remembered for «Back to…».
   */
  | {
      readonly type: "choose-paint";
      readonly paint: ChosenPaint;
      readonly remember?: boolean;
    }
  /** The search is emptied: the base stays, but no longer as a paint. */
  | { readonly type: "clear-paint" }
  | { readonly type: "set-theme"; readonly theme: Theme }
  | { readonly type: "set-locale"; readonly locale: Locale }
  | { readonly type: "dismiss-install" };

export const DEFAULT_PREFERENCES: Preferences = Object.freeze({
  filters: Object.freeze({
    excludedBrands: Object.freeze([]),
    extraTypes: Object.freeze([]),
    includeMetallic: false,
    includeDiscontinued: false,
  }),
  view: "by-brand",
  theme: "system",
  locale: null,
  installDismissed: false,
  wheel: null,
  paint: null,
});

export const INITIAL_STATE: ScreenState = Object.freeze({
  preferences: DEFAULT_PREFERENCES,
  restored: false,
  restoredWheel: null,
  tab: 0,
  more: Object.freeze({}),
  previousPaint: null,
});

/** How many results to show for a key of «See more». */
export function limitOf(state: Pick<ScreenState, "more">, key: string): number {
  return state.more[key] ?? DEFAULT_LIMIT;
}

const NO_MORE: Readonly<Record<string, number>> = Object.freeze({});

function toggle<T>(items: readonly T[], item: T): readonly T[] {
  return items.includes(item)
    ? items.filter((other) => other !== item)
    : [...items, item];
}

function withFilters(
  state: ScreenState,
  filters: Partial<Filters>,
): ScreenState {
  return {
    ...state,
    preferences: {
      ...state.preferences,
      filters: { ...state.preferences.filters, ...filters },
    },
    more: NO_MORE,
  };
}

export function reduce(state: ScreenState, action: Action): ScreenState {
  const { preferences } = state;
  switch (action.type) {
    case "restore":
      return action.preferences === null
        ? { ...state, restored: true }
        : {
            ...state,
            preferences: action.preferences,
            restored: true,
            restoredWheel: action.preferences.wheel,
          };
    case "toggle-brand":
      return withFilters(state, {
        excludedBrands: toggle(
          preferences.filters.excludedBrands,
          action.brandId,
        ),
      });
    case "toggle-type":
      return withFilters(state, {
        extraTypes: toggle(preferences.filters.extraTypes, action.paintType),
      });
    case "set-metallic":
      return withFilters(state, { includeMetallic: action.value });
    case "set-discontinued":
      return withFilters(state, { includeDiscontinued: action.value });
    case "set-view":
      return {
        ...state,
        preferences: { ...preferences, view: action.view },
        more: NO_MORE,
      };
    case "select-tab":
      return action.index === state.tab
        ? state
        : { ...state, tab: action.index, more: NO_MORE };
    case "show-more":
      return {
        ...state,
        more: {
          ...state.more,
          [action.key]: limitOf(state, action.key) + DEFAULT_LIMIT,
        },
      };
    case "show-less": {
      const rest = Object.fromEntries(
        Object.entries(state.more).filter(([key]) => key !== action.key),
      );
      return {
        ...state,
        more: Object.keys(rest).length === 0 ? NO_MORE : rest,
      };
    }
    case "colors-changed": {
      // The tab stays on the same position if the harmony still has it.
      const tab = Math.min(state.tab, Math.max(action.count - 1, 0));
      return state.more === NO_MORE && tab === state.tab
        ? state
        : { ...state, tab, more: NO_MORE };
    }
    case "wheel-changed": {
      // The base moved away from the chosen paint: «Back to…» remembers it.
      const { paint } = preferences;
      const moved =
        paint !== null &&
        action.wheel.color.toLowerCase() !== paint.hex.toLowerCase();
      return {
        ...state,
        preferences: {
          ...preferences,
          wheel: action.wheel,
          paint: moved ? null : paint,
        },
        previousPaint: moved ? paint : state.previousPaint,
      };
    }
    case "choose-paint":
      // docs/07 §15: the base tab, where the paint is the first of its brand.
      return {
        ...state,
        preferences: { ...preferences, paint: action.paint },
        previousPaint: action.remember === true ? preferences.paint : null,
        tab: 0,
        more: NO_MORE,
      };
    case "clear-paint":
      return {
        ...state,
        preferences: { ...preferences, paint: null },
        previousPaint: null,
      };
    case "set-theme":
      return { ...state, preferences: { ...preferences, theme: action.theme } };
    case "set-locale":
      return {
        ...state,
        preferences: { ...preferences, locale: action.locale },
      };
    case "dismiss-install":
      return {
        ...state,
        preferences: { ...preferences, installDismissed: true },
      };
  }
}
