import { Module } from "@nestjs/common";
import { ConfigModule } from "./core/config/config.module.ts";
import { DatabaseModule } from "./core/database/database.module.ts";
import { HealthModule } from "./core/health/health.module.ts";
import { CatalogModule } from "./features/catalog/catalog.module.ts";

/**
 * The root module: what every API needs, in core/, and the features of the
 * product, in features/ (docs/09 §1).
 */
@Module({
  imports: [ConfigModule, DatabaseModule, HealthModule, CatalogModule],
})
export class AppModule {}
