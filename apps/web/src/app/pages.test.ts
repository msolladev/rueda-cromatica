import { describe, expect, it } from "vitest";
import {
  allPages,
  notFoundAt,
  notFoundFiles,
  pageOf,
  pathOf,
  withLocale,
} from "./pages.ts";

describe("pages", () => {
  it("has the language page and, per language, home and credits", () => {
    expect(allPages()).toHaveLength(21);
    expect(allPages().map(pathOf)).toContain("/pt-br/creditos/");
    // The credits page is named in the language of the page.
    expect(allPages().map(pathOf)).toContain("/de/danksagungen/");
  });

  it("finds each page from its path, with or without the final slash", () => {
    for (const page of allPages()) {
      expect(pageOf(pathOf(page))).toEqual(page);
    }
    expect(pageOf("/es")).toEqual({ kind: "home", locale: "es" });
    expect(pageOf("/zh-hans/credits")).toEqual({
      kind: "credits",
      locale: "zh-Hans",
    });
  });

  it.each(["/xx/", "/es/other/", "/es/creditos/more/", "/es/credits/", "/ES/"])(
    "has no page for %s",
    (path) => {
      expect(pageOf(path)).toBeUndefined();
    },
  );

  it("changes the language of a page, and sends `/` to a home", () => {
    expect(withLocale({ kind: "credits", locale: "es" }, "ko")).toEqual({
      kind: "credits",
      locale: "ko",
    });
    expect(withLocale({ kind: "languages" }, "fr")).toEqual({
      kind: "home",
      locale: "fr",
    });
  });

  it("answers an unknown address in its language, or in English", () => {
    expect(notFoundAt("/es/inventada/")).toEqual({
      kind: "not-found",
      locale: "es",
    });
    expect(notFoundAt("/pt-br/x")).toEqual({
      kind: "not-found",
      locale: "pt-BR",
    });
    expect(notFoundAt("/xx/algo")).toEqual({ kind: "not-found", locale: "en" });
    expect(notFoundAt("/")).toEqual({ kind: "not-found", locale: "en" });
  });

  it("has a «Page not found» file per language and one for the rest", () => {
    const files = notFoundFiles().map(({ file }) => file);
    expect(files).toContain("/404.html");
    expect(files).toContain("/es/404.html");
    expect(files).toHaveLength(11);
    // Not a page of the sitemap.
    expect(allPages().some((page) => page.kind === "not-found")).toBe(false);
  });

  it("changes the language of «Page not found» to that language's home", () => {
    expect(withLocale({ kind: "not-found", locale: "es" }, "de")).toEqual({
      kind: "home",
      locale: "de",
    });
  });
});
