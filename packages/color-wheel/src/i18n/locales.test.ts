import { describe, expect, it } from "vitest";

import { labelsFor } from "../ui/labels.ts";
import {
  assertLocale,
  LOCALES,
  resolveLocale,
  type Locale,
} from "./locales.ts";
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
    [["ca-ES"], "ca"],
    [["eu-ES"], "eu"],
    [["gl-ES"], "gl"],
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

describe("labelsFor", () => {
  it("gives the texts of a locale without a wheel", () => {
    expect(labelsFor("es").harmony.triad).toBe("Tríada");
    expect(labelsFor("en").role.shadow).toBe("Shadow");
  });

  it("gives a new object each time", () => {
    const first = labelsFor("fr");
    expect(labelsFor("fr")).not.toBe(first);
    expect(labelsFor("fr")).toEqual(first);
  });

  it("rejects an unknown locale", () => {
    expect(() => labelsFor("xx" as Locale)).toThrow(RangeError);
  });
});
