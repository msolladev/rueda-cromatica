import { describe, expect, it } from "vitest";
import { toHexColor } from "./schema.ts";

describe("toHexColor", () => {
  it("lowercases a 6-digit hex", () => {
    expect(toHexColor("#FBB81C")).toBe("#fbb81c");
  });

  it.each(["FBB81C", "#FB1", "#FBB81CC", "#GGGGGG"])("rejects %s", (text) => {
    expect(toHexColor(text)).toBeNull();
  });
});
