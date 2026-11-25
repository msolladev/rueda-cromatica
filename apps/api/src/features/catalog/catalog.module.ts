import { Module } from "@nestjs/common";
import { CatalogBuildService } from "./catalog-build.service.ts";
import { CatalogController } from "./catalog.controller.ts";
import { DraftService } from "./draft.service.ts";
import { LoadCatalogService } from "./load-catalog.service.ts";
import { PublicationsService } from "./publications.service.ts";

/**
 * The catalog in the database (ADR-0037, ADR-0043): its draft, its
 * publications, the generation from the draft and the published catalog.
 */
@Module({
  controllers: [CatalogController],
  providers: [
    CatalogBuildService,
    DraftService,
    LoadCatalogService,
    PublicationsService,
  ],
  exports: [CatalogBuildService, LoadCatalogService],
})
export class CatalogModule {}
