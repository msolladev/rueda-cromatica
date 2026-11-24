import { describe, expect, it } from "vitest";
import { parseEnvironment } from "./environment.ts";

const DATABASE_URL = "postgresql://user:password@127.0.0.1:5432/database";

describe("parseEnvironment", () => {
  it("fills in the defaults", () => {
    expect(parseEnvironment({ DATABASE_URL })).toEqual({
      DATABASE_URL,
      HOST: "127.0.0.1",
      PORT: 3000,
      REFERENCE_HOSTS: [],
    });
  });

  it("reads the port and the hosts of the reference", () => {
    const environment = parseEnvironment({
      DATABASE_URL,
      PORT: "8080",
      REFERENCE_HOSTS: " Colorwheel.msolla.dev, ,localhost",
    });
    expect(environment.PORT).toBe(8080);
    expect(environment.REFERENCE_HOSTS).toEqual([
      "colorwheel.msolla.dev",
      "localhost",
    ]);
  });

  it.each([
    ["without DATABASE_URL", {}],
    ["with a database other than PostgreSQL", { DATABASE_URL: "mysql://h/d" }],
    ["with an invalid port", { DATABASE_URL, PORT: "70000" }],
  ])("stops the API %s, naming the variable", (_, variables) => {
    expect(() => parseEnvironment(variables)).toThrow(
      /Invalid environment variables:[\s\S]*(DATABASE_URL|PORT)/,
    );
  });
});
