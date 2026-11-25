import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

/**
 * The variables of the integration tests: those of `.env.test`, unless the
 * environment sets them, as the CI does.
 */
const integrationEnv = Object.fromEntries(
  Object.entries(parseEnv(readFileSync(".env.test", "utf8"))).map(
    ([name, value]) => [name, process.env[name] ?? value ?? ""],
  ),
);

// Two levels (docs/09 §7). Vite compiles NestJS's decorators and their type
// metadata from tsconfig.json, without SWC.
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.integration.test.ts"],
        },
      },
      {
        // The whole API, with its PostgreSQL: the database of `DATABASE_URL`,
        // created again and migrated before the tests.
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.integration.test.ts"],
          env: integrationEnv,
          globalSetup: ["test/database.ts"],
          // One file after another: they share the database, and some write.
          fileParallelism: false,
        },
      },
    ],
  },
});
