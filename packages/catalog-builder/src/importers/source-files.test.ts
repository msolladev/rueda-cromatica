import { describe, expect, it } from "vitest";
import { sourceIdSchema } from "@chromatic-wheel/domain";
import { sourceFiles } from "./source-files.ts";

const id = (value: string) => sourceIdSchema.parse(value);

describe("sourceFiles (ADR-0032)", () => {
  it("gives the raw file of a GitHub file pinned to a commit", () => {
    expect(
      sourceFiles({
        id: id("simogecko-citadel-colours"),
        url: "https://github.com/SimoGecko/CitadelColours/blob/0ea153b7c6e747cf15691dd16b8e8cc6a4551244/tables/citadel_official_colors_table.md",
      }),
    ).toEqual({
      ok: true,
      value: [
        {
          url: "https://raw.githubusercontent.com/SimoGecko/CitadelColours/0ea153b7c6e747cf15691dd16b8e8cc6a4551244/tables/citadel_official_colors_table.md",
          name: "citadel_official_colors_table.md",
        },
      ],
    });
  });

  it("gives the listed raw files of a GitHub folder pinned to a commit", () => {
    const raw =
      "https://raw.githubusercontent.com/DonnervS/miniature-paints/7097a03e4fe2cf9b815a5a5a4eab85478a14737b/paints/json";
    expect(
      sourceFiles({
        id: id("donnervs-miniature-paints"),
        url: "https://github.com/DonnervS/miniature-paints/tree/7097a03e4fe2cf9b815a5a5a4eab85478a14737b",
      }),
    ).toEqual({
      ok: true,
      value: [
        { url: `${raw}/AK.json`, name: "AK.json" },
        { url: `${raw}/Army_Painter.json`, name: "Army_Painter.json" },
        { url: `${raw}/Vallejo.json`, name: "Vallejo.json" },
      ],
    });
  });

  it("gives the URL itself for any other source, such as a PDF", () => {
    // A fictitious chart.
    expect(
      sourceFiles({
        id: id("acme-chart"),
        url: "https://example.com/acme.pdf",
      }),
    ).toEqual({
      ok: true,
      value: [{ url: "https://example.com/acme.pdf", name: "acme.pdf" }],
    });
    expect(sourceFiles({ id: id("acme-chart"), url: null })).toEqual({
      ok: true,
      value: null,
    });
  });

  it("gives the captures of a source whose original is gone (ADR-0035)", () => {
    expect(
      sourceFiles({
        id: id("games-workshop-paints-inks-checklist-2004"),
        url: "http://us.games-workshop.com/games/warhammer/painting/checklists/assets/PaintingChecklistCard.pdf",
      }),
    ).toEqual({
      ok: true,
      value: [
        {
          url: "https://web.archive.org/web/20060719172124id_/http://us.games-workshop.com/games/warhammer/painting/checklists/assets/PaintingChecklistCard.pdf",
          name: "PaintingChecklistCard.pdf",
        },
      ],
    });
  });

  it("fails on a GitHub URL not pinned, or a folder without its files", () => {
    expect(
      sourceFiles({
        id: id("acme-chart"),
        url: "https://github.com/acme/chart/blob/main/chart.md",
      }).ok,
    ).toBe(false);
    expect(
      sourceFiles({
        id: id("acme-chart"),
        url: "https://github.com/acme/chart/tree/0ea153b7c6e747cf15691dd16b8e8cc6a4551244",
      }).ok,
    ).toBe(false);
  });
});
