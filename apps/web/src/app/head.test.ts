import { describe, expect, it } from "vitest";
import { headOf, langOf } from "./head.ts";

const ORIGIN = "https://example.org";

describe("headOf", () => {
  it("gives the title, description and canonical URL of a page", () => {
    const head = headOf({ kind: "credits", locale: "es" }, ORIGIN);
    expect(head).toContain(
      "<title>Créditos y fuentes · Rueda cromática</title>",
    );
    expect(head).toContain(
      '<link rel="canonical" href="https://example.org/es/credits/" />',
    );
    expect(head).toContain(
      '<meta property="og:url" content="https://example.org/es/credits/" />',
    );
  });

  it("links every language of the same page, and `/` as x-default", () => {
    const head = headOf({ kind: "home", locale: "de" }, ORIGIN);
    expect(head.match(/hreflang=/g)).toHaveLength(11);
    expect(head).toContain(
      'hreflang="pt-BR" href="https://example.org/pt-br/"',
    );
    expect(head).toContain('hreflang="x-default" href="https://example.org/"');
  });

  it("adds structured data to the home pages only", () => {
    expect(headOf({ kind: "home", locale: "en" }, ORIGIN)).toContain(
      '"@type":"WebApplication"',
    );
    expect(headOf({ kind: "credits", locale: "en" }, ORIGIN)).not.toContain(
      "ld+json",
    );
  });

  it("is in English for `/`", () => {
    expect(langOf({ kind: "languages" })).toBe("en");
    expect(headOf({ kind: "languages" }, ORIGIN)).toContain(
      "<title>Color wheel for painting miniatures</title>",
    );
  });
});
