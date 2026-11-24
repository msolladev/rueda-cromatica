import { describe, expect, it } from "vitest";
import { instantSchema, toInstant } from "./instant.ts";

describe("instantSchema", () => {
  it("accepts what toISOString() writes", () => {
    const text = new Date(Date.UTC(2027, 2, 1, 9)).toISOString();
    expect(instantSchema.parse(text)).toBe("2027-03-01T09:00:00.000Z");
  });

  it.each([
    ["without milliseconds", "2027-03-01T09:00:00Z"],
    ["with microseconds", "2027-03-01T09:00:00.000000Z"],
    ["with an offset", "2027-03-01T10:00:00.000+01:00"],
    ["without a zone", "2027-03-01T09:00:00.000"],
    ["a date only", "2027-03-01"],
    ["an impossible date", "2027-02-30T09:00:00.000Z"],
  ])("rejects an instant %s", (_, text) => {
    expect(instantSchema.safeParse(text).success).toBe(false);
  });
});

describe("toInstant", () => {
  it("writes the date in UTC, whatever the local time zone", () => {
    expect(toInstant(new Date("2027-03-01T10:00:00+01:00"))).toBe(
      "2027-03-01T09:00:00.000Z",
    );
  });

  it("throws on an invalid date", () => {
    expect(() => toInstant(new Date(""))).toThrow(RangeError);
  });
});
