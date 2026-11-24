import { Global, Module } from "@nestjs/common";
import { ENVIRONMENT, parseEnvironment } from "./environment.ts";

/** Provides the {@link Environment} to the whole API. */
@Global()
@Module({
  providers: [
    { provide: ENVIRONMENT, useFactory: () => parseEnvironment(process.env) },
  ],
  exports: [ENVIRONMENT],
})
export class ConfigModule {}
