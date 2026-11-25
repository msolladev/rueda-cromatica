import { describe, expect, it } from "vitest";
import {
  SAMPLED_GROUP,
  transcribeSimoGecko,
  transcribeSimoGeckoSampled,
} from "./simogecko.ts";

// Fictitious rows in the layout of the table.
const table = (...rows: string[]): string =>
  [
    "# Citadel Official Colours Table",
    "| Name | Type | Finish | Code | Color |",
    "| ---- | ---- | ------ | ---- | ----- |",
    ...rows,
  ].join("\n");

const box = '<div class="colorbox" style="background: #000000;" />';

function transcribed(markdown: string) {
  const result = transcribeSimoGecko(markdown);
  if (!result.ok) throw new Error(result.error.join("\n"));
  return result.value;
}

describe("transcribeSimoGecko", () => {
  it("copies a row literally, keyed by its type and name", () => {
    expect(
      transcribed(table(`| Acme Yelow | base |  | \`#FBB81C\` | ${box} |`)),
    ).toEqual([
      {
        key: "base/Acme Yelow",
        group: "base",
        name: "Acme Yelow",
        code: null,
        hex: "#FBB81C",
        gradient: null,
        measuredHex: null,
        finish: null,
        colourless: false,
      },
    ]);
  });

  it("keeps both ends of a gradient and the finish", () => {
    const [row] = transcribed(
      table(`| Acme Steel | base | metal | \`#000000_#FFFFFF\` | ${box} |`),
    );
    expect(row?.hex).toBeNull();
    expect(row?.gradient).toEqual({ dark: "#000000", light: "#FFFFFF" });
    expect(row?.finish).toBe("metal");
  });

  it("transcribes every type, in or out of the catalogue", () => {
    const rows = transcribed(
      table(
        `| Acme Black | base |  | \`#000000\` | ${box} |`,
        `| Acme Black | spray |  | \`#000000\` | ${box} |`,
        `| Acme Thinner | air | medium | \`#FFFFFF\` | ${box} |`,
      ),
    );
    expect(rows.map((r) => r.key)).toEqual([
      "base/Acme Black",
      "spray/Acme Black",
      "air/Acme Thinner",
    ]);
  });

  it("skips the lines that are not data rows", () => {
    expect(transcribed(table())).toEqual([]);
  });

  it("fails on an unreadable colour", () => {
    const result = transcribeSimoGecko(
      table(`| Acme Red | base |  | \`#FF00\` | ${box} |`),
    );
    expect(result.ok ? [] : result.error).toEqual([
      'line 4: unreadable row "| Acme Red | base |  | `#FF00` | <div class="colorbox" style="background: #000000;" /> |"',
    ]);
  });
});

describe("transcribeSimoGeckoSampled", () => {
  // Fictitious rows in the layout of the sampled table.
  const sampled = (...rows: string[]): string =>
    [
      "# Citadel Colours Sampled Values",
      "| Name | Color | HEX | RGB | HSL | CMYK |",
      "| ---- | ----- | --- | --- | --- | ---- |",
      ...rows,
    ].join("\n");

  it("copies a row literally, keyed by its name, in the table's only group", () => {
    const result = transcribeSimoGeckoSampled(
      sampled(
        `| Acme Yelow | ${box} | \`#F3A014\` | \`rgb(243, 160, 20)\` | \`hsl(38, 90%, 52%)\` | \`cmyk(0%, 34%, 92%, 5%)\` |`,
      ),
    );
    expect(result).toEqual({
      ok: true,
      value: [
        {
          key: "Acme Yelow",
          group: SAMPLED_GROUP,
          name: "Acme Yelow",
          code: null,
          hex: "#F3A014",
          gradient: null,
          measuredHex: null,
          finish: null,
          colourless: false,
        },
      ],
    });
  });

  it("fails on a row it cannot read", () => {
    const result = transcribeSimoGeckoSampled(
      sampled(`| Acme Grey | ${box} | \`#12345\` | | | |`),
    );
    expect(result.ok).toBe(false);
  });
});
