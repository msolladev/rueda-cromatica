import { ServiceUnavailableException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { HealthController } from "./health.controller.ts";
import { healthSchema } from "./health.schema.ts";
import { HealthService } from "./health.service.ts";

/**
 * The controller, with a stand-in for its service. NestJS injects it from
 * the constructor's type metadata, so these tests also check that the tests
 * compile the decorators as the build does.
 */
async function controllerWithDatabase(up: boolean): Promise<HealthController> {
  const module = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [
      {
        provide: HealthService,
        useValue: { isDatabaseUp: () => Promise.resolve(up) },
      },
    ],
  }).compile();
  return module.get(HealthController);
}

describe("HealthController", () => {
  it("answers ok, with the instant in UTC, while the database is up", async () => {
    const controller = await controllerWithDatabase(true);
    const health = await controller.check();
    expect(healthSchema.parse(health).status).toBe("ok");
  });

  it("answers 503 while the database is down", async () => {
    const controller = await controllerWithDatabase(false);
    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
