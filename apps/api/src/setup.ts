import {
  StandardSchemaSerializerInterceptor,
  StandardSchemaValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { ENVIRONMENT, type Environment } from "./core/config/environment.ts";
import { createOpenApiDocument } from "./core/reference/openapi.ts";
import { serveReference } from "./core/reference/reference.ts";

/** The prefix of every route (ADR-0040). */
export const API_PREFIX = "api";

/**
 * Sets up an API: the prefix, the versioning, the validation, and the
 * reference (docs/09 §2-5). The same function for main.ts and for the tests,
 * so that they test what runs.
 */
export function setUpApp(app: NestExpressApplication): void {
  app.disable("x-powered-by");
  app.setGlobalPrefix(API_PREFIX);
  // Every controller declares its version: there is no route without one
  // that means "the latest" (ADR-0038).
  app.enableVersioning({ type: VersioningType.URI });
  // The schemas of the parameters validate the requests, and those of
  // `Returns` the responses.
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.useGlobalInterceptors(
    new StandardSchemaSerializerInterceptor(app.get(Reflector)),
  );

  const environment = app.get<Environment>(ENVIRONMENT);
  serveReference(
    app,
    createOpenApiDocument(app),
    `/${API_PREFIX}/v1`,
    environment.REFERENCE_HOSTS,
  );
}
