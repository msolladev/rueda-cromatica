import type { ReleaseCatalog } from "@chromatic-wheel/catalog-builder/data";
import { parseCatalog } from "@chromatic-wheel/domain";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp } from "../../../test/app.ts";
import { clearPublications, prepareCatalog } from "../../../test/catalog.ts";

let app: NestExpressApplication;
let release: ReleaseCatalog;

const get = (query: string) =>
  request(app.getHttpServer()).get(`/api/v1/catalog${query}`);

beforeAll(async () => {
  app = await createTestApp();
  ({ release } = await prepareCatalog(app));
});

afterAll(async () => {
  await app.close();
});

describe("GET /api/v1/catalog?schemaVersion=1", () => {
  it("answers the latest publication exactly as it was published", async () => {
    const response = await get("?schemaVersion=1").buffer(true);
    expect(response.status).toBe(200);
    expect(response.text).toBe(release.text);
    expect(response.headers["content-type"]).toBe(
      "application/json; charset=utf-8",
    );
    expect(parseCatalog(JSON.parse(response.text)).ok).toBe(true);
  });

  it("may be stored, but revalidated: its ETag answers 304 while it does not change", async () => {
    const { headers } = await get("?schemaVersion=1");
    const { meta } = JSON.parse(release.text) as {
      meta: { dataVersion: string };
    };
    expect(headers["cache-control"]).toBe("public, no-cache");
    expect(headers.etag).toBe(`"${meta.dataVersion}"`);

    const unchanged = await get("?schemaVersion=1").set(
      "If-None-Match",
      `"${meta.dataVersion}"`,
    );
    expect(unchanged.status).toBe(304);
    expect(unchanged.text).toBe("");

    const changed = await get("?schemaVersion=1").set(
      "If-None-Match",
      '"sha256:another"',
    );
    expect(changed.status).toBe(200);
  });

  it("answers 404 for a schema version the latest publication lacks", async () => {
    const response = await get("?schemaVersion=2");
    expect(response.status).toBe(404);
  });

  it("requires the schema version, as a whole number from 1", async () => {
    for (const query of ["", "?schemaVersion=0", "?schemaVersion=one"]) {
      expect((await get(query)).status).toBe(400);
    }
  });

  it("answers 404 while nothing is published", async () => {
    await clearPublications(app);
    expect((await get("?schemaVersion=1")).status).toBe(404);
  });
});
