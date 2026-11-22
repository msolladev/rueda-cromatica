import { describe, expect, it } from "vitest";
import { DONNERVS_RULES, transcribeDonnervS } from "./donnervs.ts";

// Fictitious rows in the layout of the DonnervS files.
const row = (patch: Record<string, unknown> = {}) => ({
  id: "acme-ac01",
  name: "Red",
  code: "AC01",
  ean: null,
  set: "Core",
  hex: "#AA0000",
  colourless: false,
  measuredHex: null,
  ...patch,
});

const file = (rows: unknown[]) => ({
  name: "Acme.json",
  content: { paints: rows },
});

function transcribed(rows: unknown[]) {
  const result = transcribeDonnervS([file(rows)]);
  if (!result.ok) throw new Error(result.error.join("\n"));
  return result.value;
}

describe("transcribeDonnervS", () => {
  it("copies a row literally, keyed by its code, without the unused fields", () => {
    expect(transcribed([row()])).toEqual([
      {
        key: "AC01",
        group: "Core",
        name: "Red",
        code: "AC01",
        hex: "#AA0000",
        gradient: null,
        measuredHex: null,
        finish: null,
        colourless: false,
      },
    ]);
  });

  it("keeps the measured hex, the missing hex and the colourless mark", () => {
    const [measured, colourless] = transcribed([
      row({ measuredHex: "#AB0101" }),
      row({ code: "AC02", hex: null, colourless: true }),
    ]);
    expect(measured?.measuredHex).toBe("#AB0101");
    expect(colourless).toMatchObject({ hex: null, colourless: true });
  });

  it("transcribes several files in order", () => {
    const result = transcribeDonnervS([
      file([row()]),
      file([row({ code: "GX01", set: "Standard" })]),
    ]);
    expect(result.ok ? result.value.map((r) => r.key) : []).toEqual([
      "AC01",
      "GX01",
    ]);
  });

  it("fails on a row without code, since the code is the key", () => {
    const result = transcribeDonnervS([file([row({ code: null })])]);
    expect(result.ok ? [] : result.error).toEqual([
      "Acme.json Core / Red: no code",
    ]);
  });
});

describe("DONNERVS_RULES.name", () => {
  const name = (code: string, written: string) =>
    transcribed([row({ code, name: written })]).map((r) =>
      DONNERVS_RULES.name?.(r),
    )[0];

  it("removes what DonnervS adds to the AK names", () => {
    expect(name("AK11334", "AFV Olive Drab Base")).toBe("Olive Drab Base");
    expect(name("AK17008", "Bile Yellow Medium")).toBe("Bile Yellow");
  });

  it("keeps the other names as written", () => {
    expect(name("72.120", "Abyssal Turquoise")).toBe("Abyssal Turquoise");
  });
});
