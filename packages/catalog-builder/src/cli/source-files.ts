/**
 * The files of each source: what its importer reads and what `archive-sources`
 * downloads (ADR-0032). One list for both, so the hashed files are the ones
 * that were transcribed. Pure.
 */
import { err, ok, type Result, type Source } from "@chromatic-wheel/domain";
import { DONNERVS_FILES } from "../importers/donnervs.ts";

/** A GitHub URL pinned to a commit: `…/blob/<sha>/<path>` or `…/tree/<sha>`. */
export interface PinnedGitHub {
  readonly repo: string;
  readonly commit: string;
  /** The file of a `blob` URL, or the folder of a `tree` URL (maybe empty). */
  readonly path: string;
  readonly kind: "blob" | "tree";
}

const PINNED_URL =
  /^https:\/\/github\.com\/([^/]+\/[^/]+)\/(blob|tree)\/([0-9a-f]{40})(?:\/(.*))?$/;

/** The parts of a GitHub URL pinned to a commit, or `null` if it is not one. */
export function pinnedGitHub(url: string): PinnedGitHub | null {
  const [, repo, kind, commit, path = ""] = PINNED_URL.exec(url) ?? [];
  if (repo === undefined || commit === undefined) return null;
  return { repo, commit, path, kind: kind === "tree" ? "tree" : "blob" };
}

export const rawUrl = (pinned: PinnedGitHub, path = pinned.path): string =>
  `https://raw.githubusercontent.com/${pinned.repo}/${pinned.commit}/${path}`;

/**
 * The files inside the folder of the `tree` sources, which their URL does not
 * name, by source ID.
 */
const TREE_FILES: Readonly<Record<string, readonly string[]>> = {
  "donnervs-miniature-paints": DONNERVS_FILES,
};

/**
 * The URLs of the files of a source:
 * - a GitHub file pinned to a commit: its raw file;
 * - a GitHub folder pinned to a commit: the raw files listed for that source;
 * - any other URL, such as a PDF of the manufacturer: the URL itself.
 *
 * `null` for a printed source, which has no URL.
 */
export function sourceFileUrls(
  source: Pick<Source, "id" | "url">,
): Result<readonly string[] | null, string> {
  if (source.url === null) return ok(null);
  if (!source.url.startsWith("https://github.com/")) return ok([source.url]);
  const pinned = pinnedGitHub(source.url);
  if (pinned === null) {
    return err(
      `${source.id}: a GitHub URL must be pinned to a commit, …/blob/<sha>/<path> or …/tree/<sha> (docs/04 §8)`,
    );
  }
  if (pinned.kind === "blob") return ok([rawUrl(pinned)]);
  const files = TREE_FILES[source.id];
  if (files === undefined) {
    return err(
      `${source.id}: its URL is a GitHub folder; list its files in TREE_FILES of src/cli/source-files.ts`,
    );
  }
  const folder = pinned.path === "" ? "" : `${pinned.path}/`;
  return ok(files.map((file) => rawUrl(pinned, `${folder}${file}`)));
}
