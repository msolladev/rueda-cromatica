import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { ENVIRONMENT, type Environment } from "../config/environment.ts";
import { PrismaClient } from "../../generated/prisma/client.ts";

/**
 * The client of the database (docs/09 §6). It connects on the first query,
 * and disconnects when the API stops.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(ENVIRONMENT) environment: Environment) {
    super({
      adapter: new PrismaPg({ connectionString: environment.DATABASE_URL }),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
