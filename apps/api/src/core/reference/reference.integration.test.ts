import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp } from "../../../test/app.ts";

// The host of .env.test's REFERENCE_HOSTS, and one that is not in it.
const REFERENCE_HOST = "reference.test";
const ADMIN_HOST = "colorwheel-admin.msolla.dev";

const PATHS = [
  "/api/v1/openapi.json",
  "/api/v1/reference",
  "/api/v1/reference/standalone.js",
  "/api/v1/reference/init.js",
];

let app: NestExpressApplication;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

describe("the reference, on the web's host", () => {
  it.each(PATHS)("serves %s without indexing it", async (path) => {
    const response = await request(app.getHttpServer())
      .get(path)
      .set("Host", REFERENCE_HOST);
    expect(response.status).toBe(200);
    expect(response.headers["x-robots-tag"]).toBe("noindex");
    expect(response.headers["content-security-policy"]).toContain(
      "script-src 'self'",
    );
  });

  it("describes the routes with their version and the instants in UTC", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/openapi.json")
      .set("Host", REFERENCE_HOST);
    const document = response.body as {
      paths: Record<string, unknown>;
      components: { schemas: Record<string, unknown> };
    };
    expect(Object.keys(document.paths)).toEqual([
      "/api/v1/health",
      "/api/v1/catalog",
    ]);
    expect(document.components.schemas["Health"]).toMatchObject({
      properties: { checkedAt: { type: "string", format: "date-time" } },
    });
  });

  it("describes the catalog with its parameter and its schema, unvalidated when served", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/openapi.json")
      .set("Host", REFERENCE_HOST);
    const document = response.body as {
      paths: Record<
        string,
        {
          get: {
            parameters: readonly { name: string; in: string }[];
            responses: Record<string, unknown>;
          };
        }
      >;
    };
    const route = document.paths["/api/v1/catalog"]?.get;
    expect(route?.parameters).toContainEqual(
      expect.objectContaining({
        name: "schemaVersion",
        in: "query",
        required: true,
      }),
    );
    expect(Object.keys(route?.responses ?? {})).toEqual(["200", "304", "404"]);
    expect(route?.responses["200"]).toMatchObject({
      content: {
        "application/json": {
          schema: { properties: { meta: {}, paints: {} } },
        },
      },
    });
  });

  it("answers 304 to a copy that has not changed", async () => {
    const server = app.getHttpServer();
    const first = await request(server)
      .get("/api/v1/reference/standalone.js")
      .set("Host", REFERENCE_HOST);
    const etag = first.headers["etag"];
    expect(etag).toBeTypeOf("string");
    const second = await request(server)
      .get("/api/v1/reference/standalone.js")
      .set("Host", REFERENCE_HOST)
      .set("If-None-Match", String(etag));
    expect(second.status).toBe(304);
  });
});

describe("the reference, on any other host", () => {
  it.each(PATHS)("does not exist: %s answers 404", async (path) => {
    const response = await request(app.getHttpServer())
      .get(path)
      .set("Host", ADMIN_HOST);
    expect(response.status).toBe(404);
  });
});
