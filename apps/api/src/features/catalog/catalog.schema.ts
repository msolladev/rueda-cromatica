import { z } from "zod";

/**
 * The parameters of `GET /api/v1/catalog`. Without an `id` of its own:
 * `@nestjs/swagger` only lists the parameters of a query schema it can
 * inline.
 */
export const catalogQuerySchema = z.object({
  schemaVersion: z.coerce
    .number()
    .int()
    .min(1)
    .describe(
      "The version of the format of catalog.json (docs/02), not of the API",
    ),
});

/** See {@link catalogQuerySchema}. */
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
