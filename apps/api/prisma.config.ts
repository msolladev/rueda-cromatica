/**
 * Prisma's configuration (docs/09 §6). The URL of the database comes from
 * `DATABASE_URL`: the scripts of package.json load it from `.env.development`
 * or `.env.test`, and the CI and the environments set it themselves, the
 * environments with the password in `DATABASE_PASSWORD_FILE`, as the API.
 */
import { defineConfig } from "prisma/config";
import { databaseUrl } from "./src/core/config/database-url.ts";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // `prisma generate` needs no database, so the URL may be missing.
  datasource: { url: databaseUrl(process.env) ?? "" },
});
