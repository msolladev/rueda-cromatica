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

describe("the password of DATABASE_PASSWORD_FILE", () => {
  const files: Record<string, string> = {
    "/run/secrets/postgres-password": "s3cr/t:@x\n",
  };
  const readFile = (path: string): string => {
    const content = files[path];
    if (content === undefined) throw new Error(`ENOENT: ${path}`);
    return content;
  };

  it("goes into DATABASE_URL, encoded and without the final line break", () => {
    const environment = parseEnvironment(
      {
        DATABASE_URL:
          "postgresql://chromatic_wheel@postgres:5432/chromatic_wheel",
        DATABASE_PASSWORD_FILE: "/run/secrets/postgres-password",
      },
      readFile,
    );
    expect(environment.DATABASE_URL).toBe(
      "postgresql://chromatic_wheel:s3cr%2Ft%3A%40x@postgres:5432/chromatic_wheel",
    );
    expect(decodeURIComponent(new URL(environment.DATABASE_URL).password)).toBe(
      "s3cr/t:@x",
    );
  });

  it("stops the API if the file cannot be read, naming the variable", () => {
    expect(() =>
      parseEnvironment(
        { DATABASE_URL, DATABASE_PASSWORD_FILE: "/missing" },
        readFile,
      ),
    ).toThrow(/DATABASE_PASSWORD_FILE[\s\S]*ENOENT/);
  });
});
