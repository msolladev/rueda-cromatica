/**
 * The configuration of the API, read once from the environment variables when
 * it starts (docs/09 §2). A missing or invalid variable stops it, with a
 * message that names the variable.
 */
import { z } from "zod";
import { databaseUrl } from "./database-url.ts";

const environmentSchema = z.object({
  /**
   * The PostgreSQL to connect to, with the password of
   * `DATABASE_PASSWORD_FILE` if it is set.
   */
  DATABASE_URL: z.url({ protocol: /^postgres(?:ql)?$/ }),
  /** The address and port to listen on. */
  HOST: z.string().min(1).default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  /**
   * The hosts, separated by commas, that serve the API reference (docs/09
   * §5): only the web's, never `apps/admin`'s. Without it, no host does.
   */
  REFERENCE_HOSTS: z
    .string()
    .default("")
    .transform((text) =>
      text
        .split(",")
        .map((host) => host.trim().toLowerCase())
        .filter((host) => host !== ""),
    ),
});

/** The configuration of the API. */
export type Environment = z.infer<typeof environmentSchema>;

/** The injection token of the {@link Environment}. */
export const ENVIRONMENT = Symbol("Environment");

/**
 * The {@link Environment} of some variables.
 *
 * @throws {Error} If a variable is missing or invalid.
 */
export function parseEnvironment(
  variables: Readonly<Record<string, string | undefined>>,
  readFile?: (path: string) => string,
): Environment {
  let url: string | undefined;
  try {
    url = databaseUrl(variables, readFile);
  } catch (error) {
    throw new Error(
      `Invalid environment variables:\n✖ DATABASE_PASSWORD_FILE: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  const result = environmentSchema.safeParse({
    ...variables,
    DATABASE_URL: url,
  });
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
