import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOCALES, messagesOf } from "../i18n/i18n.ts";

// The maintenance page (docs/08) cannot load anything from the web, which is
// down while it shows, so it carries its own copy of the icon and of the
// name of the web in each language. These tests keep
// both equal to those of the web.
const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8").replace(/\s+/g, " ");
const page = read("../../deploy/maintenance.html");
const icon = read("../../public/icons/icon.svg");

describe("the maintenance page", () => {
  it("draws the icon of the web", () => {
    const hues = [...icon.matchAll(/<path d="([^"]+)" fill="([^"]+)"\/>/g)];
    expect(hues).toHaveLength(12);
    for (const [, d, fill] of hues) {
      expect(page).toContain(`d="${d ?? ""}" fill="${fill ?? ""}"`);
    }
    const shapes = [
      ...icon.matchAll(/<(linearGradient|stop|rect|polygon) ([^>]*?)\/?>/g),
    ];
    expect(shapes).toHaveLength(5);
    for (const [, tag, attributes] of shapes) {
      expect(page).toContain(`<${tag ?? ""} ${attributes?.trim() ?? ""}`);
    }
  });

  it("has the texts of every language of the web, with its name", () => {
    const keys = [...page.matchAll(/ "?([\w-]+)"?: \[ "/g)].map(
      ([, key]) => key,
    );
    expect(keys).toEqual([...LOCALES]);
    for (const locale of LOCALES) {
      const { siteName } = messagesOf(locale).meta;
      expect(page).toMatch(
        new RegExp(` "?${locale}"?: \\[ "${siteName}",`, "u"),
      );
    }
  });
});
