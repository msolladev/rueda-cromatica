import { describe, expect, it } from "vitest";
import {
  format,
  LANGUAGE_NAMES,
  LOCALES,
  localeOfSlug,
  localeSlug,
  messagesOf,
} from "./i18n.ts";

type Tree = { readonly [key: string]: string | Tree };

const keysOf = (tree: Tree, prefix = ""): string[] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string"
      ? [`${prefix}${key}`]
      : keysOf(value, `${prefix}${key}.`),
  );

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("the web's texts", () => {
  const reference = messagesOf("es") as unknown as Tree;

  it.each(LOCALES)("%s has every text, none empty", (locale) => {
    const messages = messagesOf(locale) as unknown as Tree;
    expect(keysOf(messages).sort()).toEqual(keysOf(reference).sort());
    for (const key of keysOf(messages)) {
      const text = key
        .split(".")
        .reduce<Tree | string>(
          (node, part) => (node as Tree)[part] ?? "",
          messages,
        );
      expect(typeof text === "string" && text.trim().length > 0, key).toBe(
        true,
      );
    }
  });

  it.each(LOCALES)("%s keeps the placeholders of each text", (locale) => {
    const messages = messagesOf(locale) as unknown as Tree;
    for (const key of keysOf(reference)) {
      const get = (tree: Tree) =>
        key
          .split(".")
          .reduce<Tree | string>(
            (node, part) => (node as Tree)[part] ?? "",
            tree,
          ) as string;
      expect(placeholders(get(messages)), `${locale} ${key}`).toEqual(
        placeholders(get(reference)),
      );
    }
  });

  it("names every language in itself", () => {
    expect(Object.keys(LANGUAGE_NAMES)).toEqual([...LOCALES]);
  });
});

describe("localeSlug and localeOfSlug", () => {
  it("go back and forth for every language", () => {
    for (const locale of LOCALES)
      expect(localeOfSlug(localeSlug(locale))).toBe(locale);
    expect(localeSlug("zh-Hans")).toBe("zh-hans");
    expect(localeOfSlug("xx")).toBeUndefined();
  });
});

describe("format", () => {
  it("replaces the placeholders and keeps unknown ones", () => {
    expect(format("{count} de {total} marcas", { count: 3, total: 4 })).toBe(
      "3 de 4 marcas",
    );
    expect(format("{missing}", {})).toBe("{missing}");
  });
});
