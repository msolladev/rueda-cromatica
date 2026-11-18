import { describe, expect, it } from "vitest";
import { allPages, pageOf, pathOf, withLocale } from "./pages.ts";

describe("pages", () => {
  it("has the language page and, per language, home and credits", () => {
    expect(allPages()).toHaveLength(21);
    expect(allPages().map(pathOf)).toContain("/pt-br/credits/");
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

  it.each(["/xx/", "/es/other/", "/es/credits/more/", "/ES/"])(
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
});
