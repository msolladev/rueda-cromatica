/**
 * The URL of the database, shared by the API and Prisma's configuration
 * (docs/09 §2). In the environments, the password is not in `DATABASE_URL`
 * but in the secret file of `DATABASE_PASSWORD_FILE`, the same one that
 * PostgreSQL reads, so that it lives in a single place (docs/08).
 */
import { readFileSync } from "node:fs";

/**
 * `DATABASE_URL`, with the password of `DATABASE_PASSWORD_FILE` if it is set,
 * or `undefined` without `DATABASE_URL`. A `DATABASE_URL` that is not a URL
 * is returned as it is, for its validation to name it. The final line break
 * of the file is not part of the password.
 *
 * @throws {Error} If the file cannot be read.
 */
export function databaseUrl(
  variables: Readonly<Record<string, string | undefined>>,
  readFile: (path: string) => string = (path) => readFileSync(path, "utf8"),
): string | undefined {
  const url = variables["DATABASE_URL"];
  const passwordFile = variables["DATABASE_PASSWORD_FILE"];
  if (url === undefined || passwordFile === undefined || !URL.canParse(url)) {
    return url;
  }
  const password = readFile(passwordFile).replace(/\r?\n$/, "");
  const withPassword = new URL(url);
  withPassword.password = encodeURIComponent(password);
  return withPassword.href;
}
