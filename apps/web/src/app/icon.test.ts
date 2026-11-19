import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The icon cannot read the CSS of the page (it is an image, and the PNGs are
// pixels), so it carries the accent as a hex. This test keeps both equal.
const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
const svg = readFileSync(
  new URL("../../public/icons/icon.svg", import.meta.url),
  "utf8",
);

describe("the icon of the web", () => {
  it("uses the accent of the light theme, the first --accent of app.css", () => {
    const accent = /--accent:\s*(#[0-9a-f]{6})\s*;/i.exec(css)?.[1];
    expect(accent).toBeDefined();
    const pure = /<linearGradient id="t"[^]*?stop-color="(#[0-9a-f]{6})"/i.exec(
      svg,
    )?.[1];
    expect(pure?.toLowerCase()).toBe(accent?.toLowerCase());
    expect(svg.toLowerCase()).toContain(
      `fill="${accent?.toLowerCase() ?? ""}"`,
    );
  });
});
