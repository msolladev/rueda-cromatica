import {
  hexColorSchema,
  sourceIdSchema,
  type SourceId,
} from "@chromatic-wheel/domain";
import { describe, expect, it } from "vitest";
import {
  readSourceFile,
  sourceRowSchema,
  type ColorPolicy,
} from "../curated/files.ts";
import { acmeSource, row, valid, type Row } from "../fixtures.ts";
import {
  checkColorPolicy,
  gradientMidpoint,
  selectColor,
  type ColorCorrections,
} from "./color.ts";

describe("gradientMidpoint (ADR-0014)", () => {
  it("averages in CIELAB, not in RGB", () => {
    // L* 0 and 100 average to 50, which is #777777; RGB would give #808080.
    expect(gradientMidpoint("#000000", "#ffffff")).toBe("#777777");
  });

  it("returns the colour itself for a flat gradient", () => {
    expect(gradientMidpoint("#2d190c", "#2D190C")).toBe("#2d190c");
  });

  it("does not depend on the direction of the gradient", () => {
    expect(gradientMidpoint("#2d190c", "#e2dac8")).toBe(
      gradientMidpoint("#e2dac8", "#2d190c"),
    );
  });
});

describe("selectColor (ADR-0014, ADR-0031)", () => {
  // Fictitious sources: a manufacturer chart, a lab and two community sites.
  const acme = sourceIdSchema.parse("acme-chart");
  const initech = sourceIdSchema.parse("initech-lab");
  const globex = sourceIdSchema.parse("globex-wiki");
  const hooli = sourceIdSchema.parse("hooli-forum");
  const policy = (patch: Partial<ColorPolicy> = {}): ColorPolicy => ({
    measured: [initech],
    manufacturer: [acme],
    community: [globex, hooli],
    ...patch,
  });
  const resolved = (sourceId: SourceId, patch: Partial<Row>) => ({
    sourceId,
    row: sourceRowSchema.parse(row({ key: "AC-01", ...patch })),
    at: { file: `sources/${sourceId}.json`, path: "paints[0]" },
  });
  const none: ColorCorrections = { colorChoice: null, rejectedColors: [] };
  const hex = (text: string) => hexColorSchema.parse(text);

  const select = (
    rows: ReturnType<typeof resolved>[],
    corrections: Partial<ColorCorrections> = {},
    p = policy(),
  ) => selectColor(rows, p, { ...none, ...corrections });
  const selected = (...args: Parameters<typeof select>) =>
    valid(select(...args));
  const failures = (...args: Parameters<typeof select>) => {
    const result = select(...args);
    if (result.ok) throw new Error("Expected the selection to fail");
    return result.error;
  };

  it("normalises the hex and takes the origin of the source's list", () => {
    expect(selected([resolved(acme, { hex: "#AA0000" })]).color).toEqual({
      hex: "#aa0000",
      origin: "manufacturer",
      sourceId: acme,
    });
    expect(selected([resolved(globex, { hex: "#AA0000" })]).color?.origin).toBe(
      "community",
    );
  });

  it("reduces a gradient to its midpoint", () => {
    const rows = [
      resolved(acme, {
        hex: null,
        gradient: { dark: "#000000", light: "#FFFFFF" },
      }),
    ];
    expect(selected(rows).color?.hex).toBe("#777777");
  });

  it("is null when no row gives a colour", () => {
    expect(selected([resolved(acme, { hex: null })]).color).toBeNull();
    expect(selected([])).toEqual({ color: null, others: [] });
  });

  it("ignores a measured hex unless the source is in the measured list", () => {
    const rows = [resolved(globex, { hex: null, measuredHex: "#111111" })];
    expect(selected(rows).color).toBeNull();
    expect(selected(rows, {}, policy({ measured: [globex] })).color).toEqual({
      hex: "#111111",
      origin: "measured",
      sourceId: globex,
    });
  });

  it("prefers measured over manufacturer over community", () => {
    const rows = [
      resolved(globex, { hex: "#333333" }),
      resolved(acme, { hex: "#222222" }),
      resolved(initech, { hex: null, measuredHex: "#111111" }),
    ];
    const { color, others } = selected(rows);
    expect(color?.origin).toBe("measured");
    expect(others.map((c) => c.color.origin)).toEqual([
      "manufacturer",
      "community",
    ]);
  });

  it("takes the measured hex of a row over its own hex", () => {
    const rows = [resolved(globex, { hex: "#333333", measuredHex: "#111111" })];
    const { color } = selected(rows, {}, policy({ measured: [globex] }));
    expect(color?.hex).toBe("#111111");
  });

  it("follows the order of the policy within an origin", () => {
    const rows = [
      resolved(hooli, { hex: "#444444" }),
      resolved(globex, { hex: "#333333" }),
    ];
    expect(selected(rows).color?.sourceId).toBe(globex);
    expect(
      selected(rows, {}, policy({ community: [hooli, globex] })).color
        ?.sourceId,
    ).toBe(hooli);
  });

  describe("rejected colours", () => {
    const rows = [
      resolved(globex, { hex: "#333333" }),
      resolved(hooli, { hex: "#444444" }),
    ];
    const reject = (sourceId: SourceId, text: string) => ({
      sourceId,
      origin: "community" as const,
      hex: hex(text),
      reasonId: "photo-artifact",
      note: null,
    });

    it("leaves the candidate out and lets the priority pick the next", () => {
      const result = selected(rows, {
        rejectedColors: [reject(globex, "#333333")],
      });
      expect(result.color?.sourceId).toBe(hooli);
      expect(result.others).toEqual([]);
    });

    it("leaves a paint without colour if every candidate is rejected", () => {
      const result = selected([rows[0] ?? resolved(globex, {})], {
        rejectedColors: [reject(globex, "#333333")],
      });
      expect(result.color).toBeNull();
    });

    it("fails if the candidate now gives another hex", () => {
      expect(
        failures(rows, { rejectedColors: [reject(globex, "#3a3a3a")] }),
      ).toEqual([
        {
          path: "rejectedColors[0].hex",
          message:
            "globex-wiki (community) now gives #333333, not #3a3a3a (sources/globex-wiki.json paints[0]); review the rejection and update its hex or remove it",
        },
      ]);
    });

    it("fails if the paint has no such candidate, or rejects it twice", () => {
      const initechRejected = { ...reject(initech, "#333333") };
      expect(
        failures(rows, {
          rejectedColors: [
            initechRejected,
            reject(hooli, "#444444"),
            reject(hooli, "#444444"),
          ],
        }).map((i) => i.path),
      ).toEqual(["rejectedColors[0]", "rejectedColors[2]"]);
    });
  });

  describe("manual choice", () => {
    const rows = [
      resolved(acme, { hex: "#222222" }),
      resolved(globex, { hex: "#333333" }),
      resolved(hooli, { hex: "#444444" }),
    ];
    const choose = (sourceId: SourceId, text: string) => ({
      sourceId,
      origin: "community" as const,
      hex: hex(text),
      note: "Fictitious reason.",
    });

    it("wins over the priority", () => {
      const result = selected(rows, { colorChoice: choose(hooli, "#444444") });
      expect(result.color?.sourceId).toBe(hooli);
      expect(result.others.map((c) => c.color.sourceId)).toEqual([
        acme,
        globex,
      ]);
    });

    it("fails if the candidate now gives another hex, naming the next one", () => {
      expect(failures(rows, { colorChoice: choose(hooli, "#454545") })).toEqual(
        [
          {
            path: "colorChoice.hex",
            message:
              "hooli-forum (community) now gives #444444, not #454545 (sources/hooli-forum.json paints[0]); review the choice and update its hex or remove it; without it: #222222 from acme-chart (manufacturer), sources/acme-chart.json paints[0]",
          },
        ],
      );
    });

    it("fails if the paint has no such candidate, naming the next one", () => {
      expect(
        failures(rows.slice(0, 2), { colorChoice: choose(hooli, "#444444") }),
      ).toEqual([
        {
          path: "colorChoice",
          message:
            "hooli-forum (community) gives no colour for this paint; without it: #222222 from acme-chart (manufacturer), sources/acme-chart.json paints[0]",
        },
      ]);
    });

    it("fails if the priority already picks it", () => {
      const choice = {
        ...choose(acme, "#222222"),
        origin: "manufacturer" as const,
      };
      expect(failures(rows, { colorChoice: choice })).toEqual([
        {
          path: "colorChoice",
          message:
            "The priority already picks acme-chart (manufacturer); remove the choice",
        },
      ]);
    });

    it("fails if the chosen candidate is also rejected", () => {
      const rejected = {
        ...choose(hooli, "#444444"),
        reasonId: "photo-artifact",
      };
      expect(
        failures(rows, {
          colorChoice: choose(hooli, "#444444"),
          rejectedColors: [rejected],
        }).map((i) => i.path),
      ).toEqual(["colorChoice"]);
    });
  });
});

describe("checkColorPolicy", () => {
  const source = (hex: string | null) =>
    valid(
      readSourceFile({
        ...acmeSource(),
        content: {
          ...acmeSource().content,
          paints: [row({ key: "AC-01", hex })],
        },
      }),
    );

  it("requires a source that gives colours to be in a hex list", () => {
    const empty = { measured: [], manufacturer: [], community: [] };
    expect(checkColorPolicy(empty, [source("#000000")])).toEqual([
      "acme-chart gives colours but is neither in manufacturer nor in community",
    ]);
    expect(checkColorPolicy(empty, [source(null)])).toEqual([]);
  });

  it("rejects an unknown source", () => {
    const policy = {
      measured: [sourceIdSchema.parse("initech-lab")],
      manufacturer: [sourceIdSchema.parse("acme-chart")],
      community: [],
    };
    expect(checkColorPolicy(policy, [source(null)])).toEqual([
      "measured[0]: unknown source initech-lab",
    ]);
  });
});
