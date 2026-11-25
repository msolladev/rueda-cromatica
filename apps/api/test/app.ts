import type { ModuleMetadata } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module.ts";
import { setUpApp } from "../src/setup.ts";

/**
 * The whole API, set up as main.ts does, for the integration tests. `extra`
 * adds what a test needs, such as a controller of its own.
 */
export async function createTestApp(
  extra: ModuleMetadata = {},
): Promise<NestExpressApplication> {
  const module = await Test.createTestingModule({
    ...extra,
    imports: [AppModule, ...(extra.imports ?? [])],
  }).compile();
  const app = module.createNestApplication<NestExpressApplication>({
    logger: false,
  });
  setUpApp(app);
  await app.init();
  return app;
}
