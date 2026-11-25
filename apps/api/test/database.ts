/**
 * Prepares the database of the integration tests (docs/09 §7): drops it,
 * creates it again and applies the migrations with `prisma migrate deploy`,
 * as the deployment does (ADR-0040).
 */
import { execFileSync } from "node:child_process";
import pg from "pg";
import type { TestProject } from "vitest/node";

export default async function setup(project: TestProject): Promise<void> {
  const url = new URL(project.config.env["DATABASE_URL"] ?? "");
  const name = decodeURIComponent(url.pathname.slice(1));
  // A wrong DATABASE_URL must never drop a real database.
  if (!name.endsWith("_test")) {
    throw new Error(
      `The tests only drop a database whose name ends in "_test", not "${name}"`,
    );
  }

  // The database every PostgreSQL has, to drop and create the tests' one.
  const maintenance = new URL(url);
  maintenance.pathname = "/postgres";
  const client = new pg.Client({ connectionString: maintenance.href });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      "The integration tests need PostgreSQL: start it with `pnpm --filter @chromatic-wheel/api db:up`",
      { cause: error },
    );
  }
  try {
    const database = client.escapeIdentifier(name);
    await client.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await client.query(`CREATE DATABASE ${database}`);
  } finally {
    await client.end();
  }

  const prisma = (...args: string[]): void => {
    execFileSync("pnpm", ["exec", "prisma", ...args], {
      env: { ...process.env, DATABASE_URL: url.href },
      stdio: "inherit",
    });
  };
  prisma("migrate", "deploy");

  // The migrated database has to be what schema.prisma describes: a change
  // of the schema without its migration fails here, and in the CI.
  try {
    prisma(
      "migrate",
      "diff",
      "--from-config-datasource",
      "--to-schema",
      "prisma/schema.prisma",
      "--exit-code",
    );
  } catch (error) {
    throw new Error(
      "schema.prisma has changes without a migration: create it with `pnpm --filter @chromatic-wheel/api db:migrate`",
      { cause: error },
    );
  }
}
