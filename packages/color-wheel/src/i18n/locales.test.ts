import { describe, expect, it } from "vitest";

import { assertLocale, LOCALES, resolveLocale } from "./locales.ts";
import { TEXTS } from "./texts.ts";

/** The paths of every key of a labels object: `harmony.triad`… */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value)
    .flatMap(([key, child]) =>
      keyPaths(child, prefix === "" ? key : `${prefix}.${key}`),
    )
    .sort();
}

function values(value: unknown): unknown[] {
  return typeof value === "object" && value !== null
    ? Object.values(value).flatMap(values)
    : [value];
}

describe("locales", () => {
  it.each(LOCALES)("%s has the same keys as English", (locale) => {
    expect(keyPaths(TEXTS[locale])).toEqual(keyPaths(TEXTS.en));
  });

  it.each(LOCALES)("%s has a non-empty text for every key", (locale) => {
    for (const text of values(TEXTS[locale])) {
      expect(typeof text === "string" && text.trim() !== "").toBe(true);
    }
  });
});

describe("resolveLocale", () => {
  it.each<[string[], string]>([
    [["es"], "es"],
    [["pt-BR"], "pt-BR"],
    [["pt-br"], "pt-BR"],
    // By base language.
    [["es-ES"], "es"],
    [["pt-PT"], "pt-BR"],
    [["zh-CN"], "zh-Hans"],
    // The first match, even by base language.
    [["pt-PT", "en"], "pt-BR"],
    [["nl", "de-AT", "fr"], "de"],
    // None: English.
    [["nl", "sv"], "en"],
    [[], "en"],
  ])("%j resolves to %s", (preferred, expected) => {
    expect(resolveLocale(preferred)).toBe(expected);
  });
});

describe("assertLocale", () => {
  it("rejects a locale that is not included", () => {
    expect(() => {
      assertLocale("pt");
    }).toThrow(/Unknown locale "pt"/);
  });
});
