/**
 * Prisma's configuration (docs/09 §6). The URL of the database comes from
 * `DATABASE_URL`: the scripts of package.json load it from `.env.development`
 * or `.env.test`, and the CI and the environments set it themselves.
 */
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // `prisma generate` needs no database, so the URL may be missing.
  datasource: { url: process.env["DATABASE_URL"] ?? "" },
});
