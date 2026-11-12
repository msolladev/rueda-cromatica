import { describe, expect, it } from "vitest";
import { proposeSlug } from "./slug.ts";

describe("proposeSlug (docs/03 §3)", () => {
  it.each([
    ["Rojo Óxido", "rojo-oxido"],
    ["Bob's Blue", "bobs-blue"],
    ["Grey / Green 2", "grey-green-2"],
    ["Gehenna’s Gold", "gehennas-gold"],
    ["  Blood For The Blood God ", "blood-for-the-blood-god"],
  ])("%s → %s", (name, slug) => {
    expect(proposeSlug(name)).toBe(slug);
  });
});
