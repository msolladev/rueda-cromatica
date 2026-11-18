import { describe, expect, it } from "vitest";
import {
  parsePreferences,
  readPreferences,
  writePreferences,
} from "./persistence.ts";
import { DEFAULT_PREFERENCES } from "./state.ts";
import { STORAGE_KEY } from "./before-paint.ts";

class MemoryStorage implements Storage {
  readonly #items = new Map<string, string>();
  get length() {
    return this.#items.size;
  }
  clear() {
    this.#items.clear();
  }
  getItem(key: string) {
    return this.#items.get(key) ?? null;
  }
  key(index: number) {
    return [...this.#items.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.#items.delete(key);
  }
  setItem(key: string, value: string) {
    this.#items.set(key, value);
  }
}

const valid = {
  ...DEFAULT_PREFERENCES,
  filters: {
    excludedBrands: ["vallejo"],
    extraTypes: ["contrast"],
    includeMetallic: true,
    includeDiscontinued: false,
  },
  theme: "dark",
  locale: "de",
  wheel: { color: "#3daf44", model: "ryb", harmony: "triad", light: "warm" },
};

describe("parsePreferences", () => {
  it("accepts valid preferences", () => {
    expect(parsePreferences(valid)).toEqual(valid);
  });

  it("accepts the defaults, without a wheel or a language", () => {
    expect(parsePreferences(DEFAULT_PREFERENCES)).toEqual(DEFAULT_PREFERENCES);
  });

  it.each([
    ["not an object", 42],
    ["an unknown theme", { ...valid, theme: "sepia" }],
    ["an unknown view", { ...valid, view: "grid" }],
    ["an unknown language", { ...valid, locale: "xx" }],
    [
      "an invalid wheel color",
      { ...valid, wheel: { ...valid.wheel, color: "green" } },
    ],
    [
      "an unknown harmony",
      { ...valid, wheel: { ...valid.wheel, harmony: "pentad" } },
    ],
    [
      "an unknown paint type",
      { ...valid, filters: { ...valid.filters, extraTypes: ["spray"] } },
    ],
    ["filters without a field", { ...valid, filters: { excludedBrands: [] } }],
  ])("rejects %s", (_, value) => {
    expect(parsePreferences(value)).toBeNull();
  });

  it("drops an added type that is a default candidate", () => {
    const parsed = parsePreferences({
      ...valid,
      filters: { ...valid.filters, extraTypes: ["layer", "wash"] },
    });
    expect(parsed?.filters.extraTypes).toEqual(["wash"]);
  });
});

describe("readPreferences and writePreferences", () => {
  it("write and read back the same preferences", () => {
    const storage = new MemoryStorage();
    const preferences = parsePreferences(valid);
    if (preferences === null) throw new Error("fixture");
    writePreferences(storage, preferences);
    expect(readPreferences(storage)).toEqual(preferences);
  });

  it("read nothing from an empty, corrupt or invalid storage", () => {
    const storage = new MemoryStorage();
    expect(readPreferences(storage)).toBeNull();
    storage.setItem(STORAGE_KEY, "{not json");
    expect(readPreferences(storage)).toBeNull();
    storage.setItem(STORAGE_KEY, JSON.stringify({ theme: "dark" }));
    expect(readPreferences(storage)).toBeNull();
  });

  it("ignore a storage that throws", () => {
    const blocked = new MemoryStorage();
    blocked.getItem = () => {
      throw new Error("SecurityError");
    };
    blocked.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    expect(readPreferences(blocked)).toBeNull();
    expect(() => {
      writePreferences(blocked, DEFAULT_PREFERENCES);
    }).not.toThrow();
  });
});
