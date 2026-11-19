/**
 * Locations of the curated data and of `catalog.json` (docs/04 §2-3), and the
 * JSON reading shared by the entry points.
 */
import { readFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import type { RawFile } from "../curated/files.ts";

const PACKAGE_DIR = resolve(import.meta.dirname, "../..");
export const REPO_DIR = resolve(PACKAGE_DIR, "../..");
const DATA_DIR = join(PACKAGE_DIR, "data");
export const SOURCES_FILE = join(DATA_DIR, "sources.json");
export const BRANDS_DIR = join(DATA_DIR, "brands");
export const TOMBSTONES_FILE = join(DATA_DIR, "tombstones.json");
export const OUTPUT_FILE = join(REPO_DIR, "apps/web/public/catalog.json");

export const fromRepo = (path: string): string => relative(REPO_DIR, path);

/**
 * Reads a JSON file, named by its base name as the pipeline checks brand
 * files. On failure, returns the message to show.
 */
export async function readJson(path: string): Promise<RawFile | string> {
  try {
    const content: unknown = JSON.parse(await readFile(path, "utf8"));
    return { name: basename(path), content };
  } catch (error) {
    return `${fromRepo(path)}: ${error instanceof Error ? error.message : String(error)}`;
  }
}
