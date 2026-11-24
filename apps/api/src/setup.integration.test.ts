import { instantSchema } from "@chromatic-wheel/domain";
import { Controller, Get, Query } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createTestApp } from "../test/app.ts";
import { Returns } from "./core/http/returns.ts";

const echoQuerySchema = z.object({ at: instantSchema });

/** A route of the tests: answers the instant it receives. */
@Controller({ path: "echo", version: "1" })
class EchoController {
  @Get()
  @Returns(echoQuerySchema)
  echo(
    @Query({ schema: echoQuerySchema }) query: z.infer<typeof echoQuerySchema>,
  ): z.infer<typeof echoQuerySchema> {
    return query;
  }
}

/** A route of the tests whose answer breaks its own schema. */
@Controller({ path: "broken", version: "1" })
class BrokenController {
  @Get()
  @Returns(echoQuerySchema)
  broken(): unknown {
    return { at: "yesterday" };
  }
}

let app: NestExpressApplication;

beforeAll(async () => {
  app = await createTestApp({
    controllers: [EchoController, BrokenController],
  });
});

afterAll(async () => {
  await app.close();
});

describe("the routes", () => {
  it.each(["/api/health", "/health", "/api/v2/health", "/v1/health"])(
    "have the prefix and an explicit version: %s answers 404",
    async (path) => {
      const response = await request(app.getHttpServer()).get(path);
      expect(response.status).toBe(404);
    },
  );

  it("do not say they run on Express", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/health");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("the validation", () => {
  it("accepts an instant in UTC", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/echo")
      .query({ at: "2027-03-01T09:00:00.000Z" });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ at: "2027-03-01T09:00:00.000Z" });
  });

  it.each(["2027-03-01T10:00:00.000+01:00", "2027-03-01T09:00:00Z", ""])(
    "rejects %j with 400",
    async (at) => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/echo")
        .query({ at });
      expect(response.status).toBe(400);
    },
  );

  it("never sends an answer that breaks its schema", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/broken");
    expect(response.status).toBe(500);
    expect(response.body).not.toHaveProperty("at");
  });
});
