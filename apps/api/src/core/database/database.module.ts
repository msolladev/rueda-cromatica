import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service.ts";

/** Provides the {@link PrismaService} to the whole API. */
@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class DatabaseModule {}
