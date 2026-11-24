/**
 * Writes the curated files, for the importers and `archive-sources`. Apart
 * from the reading of `data-files.ts`, so that whoever only reads the data,
 * such as `apps/api`, does not load Prettier, a development dependency.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { format, resolveConfig } from "prettier";
import { DATA_DIR } from "./data-files.ts";

/**
 * Writes a data file as JSON, formatted with Prettier and the configuration of
 * the repository, as `pnpm format` would leave it. Prettier keeps an object
 * on several lines if it already was, so it gets the JSON indented, as the
 * curated files are written.
 */
export async function writeDataFile(
  name: string,
  content: unknown,
): Promise<void> {
  const path = join(DATA_DIR, name);
  const options = await resolveConfig(path);
  const text = await format(JSON.stringify(content, null, 2), {
    ...options,
    filepath: path,
  });
  await writeFile(path, text, "utf8");
}
