import {
  applyDecorators,
  HttpCode,
  HttpStatus,
  SerializeOptions,
} from "@nestjs/common";
import { ApiResponse } from "@nestjs/swagger";
import type { z } from "zod";

/**
 * What a route answers when it succeeds (docs/09 §3): the same schema
 * validates the response, so that it can never differ from the OpenAPI
 * specification, and documents it there.
 */
export function Returns(
  schema: z.ZodType,
  status: HttpStatus = HttpStatus.OK,
): MethodDecorator {
  return applyDecorators(
    HttpCode(status),
    SerializeOptions({ schema }),
    ApiResponse({ status, standardSchema: schema }),
  );
}
