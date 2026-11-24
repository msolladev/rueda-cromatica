import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.ts";

/** Checks that the API can do its work. */
@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  /** Whether the database answers a query. */
  async isDatabaseUp(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
