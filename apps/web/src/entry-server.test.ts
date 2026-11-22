import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allPages, createRenderer, pathOf } from "./entry-server.tsx";

// Runs in Node, without `window` or `document`: if the first render used
// anything of the browser, rendering would throw here (docs/07 §10).
const render = createRenderer({
  catalog: JSON.parse(
    readFileSync(new URL("../public/catalog.json", import.meta.url), "utf8"),
  ),
  licenses: [
    {
      kind: "package",
      name: "example",
      version: "1.0.0",
      license: "MIT",
      repository: null,
      text: "MIT License text",
    },
  ],
  origin: "https://example.org",
});

describe("the prerendering", () => {
  it.each(allPages().map((page) => [pathOf(page), page] as const))(
    "renders %s with its language and data",
    (_, page) => {
      const rendered = render(page);
      expect(rendered.html.length).toBeGreaterThan(0);
      expect(rendered.lang).toBe(
        page.kind === "languages" ? "en" : page.locale,
      );
      expect(rendered.data.kind).toBe(page.kind);
    },
  );

  it("puts the example with its paints in the HTML of each home page", () => {
    const { html } = render({ kind: "home", locale: "es" });
    expect(html).toContain(
      "<h1>Encuentra la pintura de cada color de tu esquema</h1>",
    );
    // The six colors of the miniature scheme, each with its panel.
    expect(html.match(/role="tabpanel"/g)).toHaveLength(6);
    expect(html).toContain("Moot Green");
    expect(html).toContain("Sombra");
    expect(html).toContain("Esquema de miniatura");
  });

  it("puts every source and license in the HTML of the credits", () => {
    const { html } = render({ kind: "credits", locale: "en" });
    expect(html).toContain("Citadel Official Colours Table");
    expect(html).toContain(
      "Name, Set, RGB, and Hex values of Miniature Paints",
    );
    expect(html).toContain("MIT License text");
  });

  it("puts the footer, with its links and the notice, in the HTML", () => {
    const { html } = render({ kind: "credits", locale: "es" });
    expect(html).toContain(
      'href="https://github.com/msolladev/rueda-cromatica"',
    );
    expect(html).toContain('href="https://paypal.me/miguelangelss4"');
    expect(html).toContain('href="/reference/"');
    expect(html).toContain("Proyecto independiente, sin relación con");
    // The version: the commit the web is built from, with its date.
    expect(html).toMatch(
      /Versión del \d{1,2} de \w+ de \d{4}<\/time>.*href="https:\/\/github\.com\/msolladev\/rueda-cromatica\/commit\/[0-9a-f]{40}"/s,
    );
    // The strip with the twelve hues of the wheel, computed in the render.
    expect(html).toMatch(
      /--hue-strip:linear-gradient\(to right, (#[0-9a-f]{6}(, )?){12}\)/,
    );
  });

  it("links every language from `/`", () => {
    const { html } = render({ kind: "languages" });
    for (const path of ["/es/", "/ja/", "/pt-br/"])
      expect(html).toContain(`href="${path}"`);
  });

  it("is deterministic", () => {
    const page = { kind: "home", locale: "de" } as const;
    expect(render(page).html).toBe(render(page).html);
  });
});
