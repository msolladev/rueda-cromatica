import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  EXTRA_PAINT_TYPES,
  INITIAL_STATE,
  limitOf,
  OVERALL,
  reduce,
  type Action,
  type ScreenState,
} from "./state.ts";

const run = (...actions: Action[]): ScreenState =>
  actions.reduce(reduce, INITIAL_STATE);

describe("reduce", () => {
  it("offers to add every type that is not a default candidate", () => {
    expect(EXTRA_PAINT_TYPES).toEqual([
      "wash",
      "ink",
      "glaze",
      "contrast",
      "technical",
    ]);
  });

  it("restores the saved preferences once, with the wheel to apply", () => {
    const saved = {
      ...DEFAULT_PREFERENCES,
      view: "overall" as const,
      wheel: {
        color: "#112233",
        model: "digital" as const,
        harmony: "triad" as const,
        light: "cold" as const,
      },
    };
    const state = run({ type: "restore", preferences: saved });
    expect(state.restored).toBe(true);
    expect(state.preferences).toBe(saved);
    expect(state.restoredWheel).toBe(saved.wheel);
  });

  it("marks as restored when nothing was saved", () => {
    const state = run({ type: "restore", preferences: null });
    expect(state.restored).toBe(true);
    expect(state.preferences).toBe(DEFAULT_PREFERENCES);
  });

  it("toggles brands and types, and resets «See more»", () => {
    const state = run(
      { type: "show-more", key: "vallejo" },
      { type: "toggle-brand", brandId: "ak-interactive" },
      { type: "toggle-type", paintType: "wash" },
    );
    expect(state.preferences.filters.excludedBrands).toEqual([
      "ak-interactive",
    ]);
    expect(state.preferences.filters.extraTypes).toEqual(["wash"]);
    expect(state.more).toEqual({});

    const back = reduce(state, {
      type: "toggle-brand",
      brandId: "ak-interactive",
    });
    expect(back.preferences.filters.excludedBrands).toEqual([]);
  });

  it("adds three more results each time «See more» is pressed", () => {
    const state = run(
      { type: "show-more", key: "vallejo" },
      { type: "show-more", key: "vallejo" },
      { type: "show-more", key: OVERALL },
    );
    expect(limitOf(state, "vallejo")).toBe(9);
    expect(limitOf(state, OVERALL)).toBe(6);
    expect(limitOf(state, "citadel")).toBe(3);
  });

  it("goes back to the first three of a key with «See less»", () => {
    const state = run(
      { type: "show-more", key: "vallejo" },
      { type: "show-more", key: OVERALL },
      { type: "show-less", key: "vallejo" },
    );
    expect(limitOf(state, "vallejo")).toBe(3);
    expect(limitOf(state, OVERALL)).toBe(6);
    expect(reduce(state, { type: "show-less", key: OVERALL }).more).toEqual({});
  });

  it("resets «See more» when the tab or the view changes", () => {
    const more = run({ type: "show-more", key: "vallejo" });
    expect(reduce(more, { type: "select-tab", index: 2 }).more).toEqual({});
    expect(reduce(more, { type: "set-view", view: "overall" }).more).toEqual(
      {},
    );
  });

  it("keeps the tab when the colors change, within the new count", () => {
    const state = run({ type: "select-tab", index: 5 });
    expect(reduce(state, { type: "colors-changed", count: 6 }).tab).toBe(5);
    expect(reduce(state, { type: "colors-changed", count: 2 }).tab).toBe(1);
  });

  it("returns the same state when a color change has nothing to reset", () => {
    const state = run({ type: "select-tab", index: 1 });
    expect(reduce(state, { type: "colors-changed", count: 6 })).toBe(state);
  });

  it("saves the wheel, the theme, the language and the closed banner", () => {
    const wheel = {
      color: "#3daf44",
      model: "ryb" as const,
      harmony: "triad" as const,
      light: "warm" as const,
    };
    const { preferences } = run(
      { type: "wheel-changed", wheel },
      { type: "set-theme", theme: "dark" },
      { type: "set-locale", locale: "ja" },
      { type: "dismiss-install" },
    );
    expect(preferences).toMatchObject({
      wheel,
      theme: "dark",
      locale: "ja",
      installDismissed: true,
    });
  });
});
