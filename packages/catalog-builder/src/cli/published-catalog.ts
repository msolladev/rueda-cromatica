/**
 * Reads the catalog of the latest release from git (docs/03 §7): the
 * `catalog.json` at the newest release tag.
 */
import { execFile } from "node:child_process";
import { relative } from "node:path";
import { promisify } from "node:util";
import { err, ok, type Result } from "@chromatic-wheel/domain";
import {
  catalogIds,
  latestRelease,
  RELEASE_TAG_PREFIX,
  type PublishedCatalog,
} from "../pipeline/id-stability.ts";
import { OUTPUT_FILE, REPO_DIR } from "./data-files.ts";

const run = promisify(execFile);

async function git(...args: string[]): Promise<string> {
  const { stdout } = await run("git", args, {
    cwd: REPO_DIR,
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

/**
 * The `release/*` tags of the repository, or the messages to show. A shallow
 * clone fails instead of passing: it may lack the tags, and then the check
 * would compare nothing without anyone noticing.
 */
export async function releaseTags(): Promise<
  Result<readonly string[], readonly string[]>
> {
  try {
    if ((await git("rev-parse", "--is-shallow-repository")).trim() === "true") {
      return err([
        "The repository is a shallow clone, so the release tags may be missing.",
        "Fetch the full history and the tags (in CI: fetch-depth: 0).",
      ]);
    }
    const tags = await git("tag", "--list", `${RELEASE_TAG_PREFIX}*`);
    return ok(tags.split("\n").filter(Boolean));
  } catch (error) {
    return err([
      `Could not read the release tags from git: ${error instanceof Error ? error.message : String(error)}`,
    ]);
  }
}

/** The published catalog, `null` before the first release, or the messages to show. */
export async function readPublishedCatalog(): Promise<
  Result<PublishedCatalog | null, readonly string[]>
> {
  const tags = await releaseTags();
  if (!tags.ok) return tags;
  try {
    const release = latestRelease(tags.value);
    if (!release.ok) return release;
    if (release.value === null) return ok(null);

    const path = relative(REPO_DIR, OUTPUT_FILE).replaceAll("\\", "/");
    const ids = catalogIds(
      JSON.parse(await git("show", `${release.value}:${path}`)),
    );
    if (!ids.ok) return err([`${release.value}:${path}: ${ids.error}`]);
    return ok({ release: release.value, ids: ids.value });
  } catch (error) {
    return err([
      `Could not read the latest release from git: ${error instanceof Error ? error.message : String(error)}`,
    ]);
  }
}
