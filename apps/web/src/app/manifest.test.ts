import { describe, expect, it } from "vitest";
import { LOCALES } from "../i18n/i18n.ts";
import { headOf } from "./head.ts";
import { allManifests, manifestOf, manifestPathOf } from "./manifest.ts";

const parse = (json: string) => JSON.parse(json) as Record<string, unknown>;

describe("the manifests", () => {
  it("has one per language, at its own address", () => {
    expect(allManifests().map(({ path }) => path)).toEqual(
      LOCALES.map(manifestPathOf),
    );
    expect(manifestPathOf("pt-BR")).toBe("/pt-br/manifest.webmanifest");
  });

  it("names the web in each language, and opens in it", () => {
    expect(parse(manifestOf("en"))).toMatchObject({
      name: "Chromatic Wheel",
      short_name: "Chromatic Wheel",
      lang: "en",
      start_url: "/en/",
    });
    expect(parse(manifestOf("es"))).toMatchObject({
      name: "Rueda cromática",
      lang: "es",
      start_url: "/es/",
    });
  });

  it("is the same app in every language", () => {
    const shared = (locale: (typeof LOCALES)[number]) => {
      const { id, scope, display, icons } = parse(manifestOf(locale));
      return { id, scope, display, icons };
    };
    for (const locale of LOCALES) {
      expect(shared(locale)).toEqual(shared("en"));
    }
  });

  it("is linked by every page, in its language", () => {
    expect(
      headOf({ kind: "credits", locale: "de" }, "https://x.org"),
    ).toContain('<link rel="manifest" href="/de/manifest.webmanifest" />');
    expect(
      headOf({ kind: "not-found", locale: "eu" }, "https://x.org"),
    ).toContain('<link rel="manifest" href="/eu/manifest.webmanifest" />');
    expect(headOf({ kind: "languages" }, "https://x.org")).toContain(
      '<link rel="manifest" href="/en/manifest.webmanifest" />',
    );
  });
});
