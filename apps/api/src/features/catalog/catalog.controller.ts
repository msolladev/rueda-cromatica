import { catalogDocumentSchema } from "@chromatic-wheel/domain";
import { Controller, Get, NotFoundException, Query, Res } from "@nestjs/common";
import {
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";
import type { Response } from "express";
import { Documents } from "../../core/http/returns.ts";
import { catalogQuerySchema, type CatalogQuery } from "./catalog.schema.ts";
import { PublicationsService } from "./publications.service.ts";

/**
 * The published catalog (docs/09 §8.4), for anyone and without a session: the
 * build of the web downloads it, and anyone can read it, as `catalog.json`
 * today (ADR-0037).
 */
@Controller({ path: "catalog", version: "1" })
export class CatalogController {
  constructor(private readonly publications: PublicationsService) {}

  @Get()
  @ApiOperation({
    summary: "The catalog of the latest publication",
    description:
      "Exactly the `catalog.json` of the latest publication, in the given schema version. It may be stored, but it must be revalidated before each use: `If-None-Match` with its `ETag` answers 304 while it does not change.",
  })
  // Sent as it was stored, and validated when stored (docs/09 §3).
  @Documents(catalogDocumentSchema)
  @ApiHeader({ name: "If-None-Match", required: false })
  @ApiResponse({ status: 304, description: "The catalog has not changed" })
  @ApiNotFoundResponse({
    description:
      "Nothing is published, or the latest publication lacks that schema version",
  })
  async latest(
    @Query({ schema: catalogQuerySchema }) query: CatalogQuery,
    @Res() response: Response,
  ): Promise<void> {
    const catalog = await this.publications.latestCatalog(query.schemaVersion);
    if (catalog === null) {
      throw new NotFoundException(
        `No published catalog in schema version ${String(query.schemaVersion)}`,
      );
    }
    // The data version identifies the bytes: the serialization is
    // deterministic, and `meta` only adds the schema version (docs/02 §4).
    // Express answers 304 by itself when `If-None-Match` matches it.
    response
      .set({
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, no-cache",
        ETag: `"${catalog.dataVersion}"`,
      })
      .send(catalog.content);
  }
}
