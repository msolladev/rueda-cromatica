import { toInstant } from "@chromatic-wheel/domain";
import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiServiceUnavailableResponse } from "@nestjs/swagger";
import { Returns } from "../http/returns.ts";
import { type Health, healthSchema } from "./health.schema.ts";
import { HealthService } from "./health.service.ts";

/**
 * Whether the API works, for the checks of the deployment (docs/09 §2). It
 * needs no session.
 */
@Controller({ path: "health", version: "1" })
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({ summary: "Checks that the API and its database work" })
  @Returns(healthSchema)
  @ApiServiceUnavailableResponse({ description: "The database is down" })
  async check(): Promise<Health> {
    if (!(await this.health.isDatabaseUp())) {
      throw new ServiceUnavailableException("The database is down");
    }
    return { status: "ok", checkedAt: toInstant(new Date()) };
  }
}
