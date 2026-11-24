import type { INestApplication } from "@nestjs/common";
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from "@nestjs/swagger";

/**
 * The OpenAPI specification of the API (docs/09 §5), from the schemas of its
 * routes. Created once the prefix and the versioning are set, so that its
 * paths are the real ones.
 */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("Chromatic Wheel API")
    .setDescription(
      "The REST API of Chromatic Wheel: the paint catalog, the users' preferences and the catalog's administration. Every date is an instant in UTC, as written by `toISOString()`.",
    )
    .setVersion("1")
    .build();
  return SwaggerModule.createDocument(app, config);
}
