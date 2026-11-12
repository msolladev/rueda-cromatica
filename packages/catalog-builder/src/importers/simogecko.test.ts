import { describe, expect, it } from "vitest";
import { importSimoGecko } from "./simogecko.ts";

const table = (...rows: string[]): string =>
  [
    "# Citadel Official Colours Table",
    "| Name | Type | Finish | Code | Color |",
    "| ---- | ---- | ------ | ---- | ----- |",
    ...rows,
  ].join("\n");

const box = '<div class="colorbox" style="background: #000000;" />';

function imported(markdown: string) {
  const result = importSimoGecko(markdown, "simogecko");
  if (!result.ok) throw new Error(result.error.join("\n"));
  return result.value;
}

describe("importSimoGecko", () => {
  it("reads a row into a paint of its MVP line, with lowercase hex", () => {
    expect(
      imported(table(`| Averland Sunset | base |  | \`#FBB81C\` | ${box} |`)),
    ).toEqual([
      {
        rangeId: "citadel/base",
        name: "Averland Sunset",
        manufacturerCode: null,
        type: "base",
        metallic: false,
        color: { hex: "#fbb81c", origin: "community", sourceId: "simogecko" },
      },
    ]);
  });

  it("maps the table types to ranges and paint types (ADR-0013)", () => {
    const paints = imported(
      table(
        `| A | base |  | \`#000000\` | ${box} |`,
        `| B | layer |  | \`#000000\` | ${box} |`,
        `| C | shade |  | \`#000000\` | ${box} |`,
        `| D | contrast |  | \`#000000\` | ${box} |`,
        `| E | technical |  | \`#000000\` | ${box} |`,
        `| F | dry |  | \`#000000\` | ${box} |`,
      ),
    );
    expect(paints.map((p) => `${p.rangeId} ${p.type}`)).toEqual([
      "citadel/base base",
      "citadel/layer layer",
      "citadel/shade wash",
      "citadel/contrast contrast",
      "citadel/technical technical",
      "citadel/dry dry",
    ]);
  });

  it("reduces a gradient to its midpoint and flags metallics", () => {
    const [paint] = imported(
      table(`| Leadbelcher | base | metal | \`#000000_#FFFFFF\` | ${box} |`),
    );
    expect(paint?.metallic).toBe(true);
    expect(paint?.color?.hex).toBe("#777777");
  });

  it("leaves out lines outside the MVP and products without colour", () => {
    expect(
      imported(
        table(
          `| Chaos Black | spray |  | \`#000000\` | ${box} |`,
          `| Abaddon Black | air |  | \`#000000\` | ${box} |`,
          `| Lahmian Medium | technical | medium | \`#DADADA_#FFFFFF\` | ${box} |`,
        ),
      ),
    ).toEqual([]);
  });

  it("fails on anything it does not recognise, naming the line", () => {
    const result = importSimoGecko(
      table(
        `| A | glaze |  | \`#000000\` | ${box} |`,
        `| B | base | matte | \`#000000\` | ${box} |`,
        `| C | base |  | \`#00000\` | ${box} |`,
      ),
      "simogecko",
    );
    expect(result.ok ? [] : result.error).toEqual([
      'line 4: unknown type "glaze"',
      'line 5: unknown finish "matte"',
      `line 6: unreadable row "| C | base |  | \`#00000\` | ${box} |"`,
    ]);
  });
});
