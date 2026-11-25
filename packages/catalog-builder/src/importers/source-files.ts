/**
 * The files of each source: what its importer reads and what `archive-sources`
 * downloads (ADR-0032). One list for both, so the hashed files are the ones
 * that were transcribed. Pure.
 */
import { err, ok, type Result, type Source } from "@chromatic-wheel/domain";
import {
  downloadName,
  type DownloadTarget,
} from "../archive/archive-sources.ts";
import { ARCTURUS_FILES } from "./arcturus.ts";
import { DONNERVS_FILES } from "./donnervs.ts";

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
  "arcturus5404-miniature-paints": ARCTURUS_FILES,
  "donnervs-miniature-paints": DONNERVS_FILES,
};

/**
 * The playback URL of a capture that answers the archived bytes as they were
 * served, without the Wayback Machine's toolbar or rewritten links.
 */
const rawCapture = (timestamp: string, url: string): string =>
  `https://web.archive.org/web/${timestamp}id_/${url}`;

/**
 * The files of the sources whose original URL no longer serves them, such as
 * the old documents of Games Workshop (ADR-0035): each one is read from a
 * capture of the Wayback Machine, chosen by hand, whose SHA-1 matches the
 * digest that the CDX API gives for it. Their names are explicit, because a
 * page ends in `/`.
 */
const CAPTURED_FILES: Readonly<Record<string, readonly DownloadTarget[]>> = {
  "games-workshop-citadel-conversion-chart-2012": [
    {
      url: rawCapture(
        "20120605023151",
        "http://www.games-workshop.com/MEDIA_CustomProductCatalog/m2320032a_Citadel_Conversion_Chart",
      ),
      name: "m2320032a_Citadel_Conversion_Chart.pdf",
    },
  ],
  "games-workshop-citadel-washes-2008": [
    {
      url: rawCapture(
        "20080608042740",
        "http://uk.games-workshop.com/painting/washes/4/",
      ),
      name: "washes-4.html",
    },
  ],
  "games-workshop-foundation-paints-2008": [
    {
      url: rawCapture(
        "20080417050427",
        "http://uk.games-workshop.com/painting/foundation-paints/1/",
      ),
      name: "foundation-paints-1.html",
    },
  ],
  "games-workshop-paints-inks-checklist-2004": [
    {
      url: rawCapture(
        "20060719172124",
        "http://us.games-workshop.com/games/warhammer/painting/checklists/assets/PaintingChecklistCard.pdf",
      ),
      name: "PaintingChecklistCard.pdf",
    },
  ],
};

/**
 * The files of a source:
 * - one listed in {@link CAPTURED_FILES}: its captures;
 * - a GitHub file pinned to a commit: its raw file;
 * - a GitHub folder pinned to a commit: the raw files listed for that source;
 * - any other URL, such as a PDF of the manufacturer: the URL itself.
 *
 * Named after the last segment of their URL, unless listed with a name.
 * `null` for a printed source, which has no URL.
 */
export function sourceFiles(
  source: Pick<Source, "id" | "url">,
): Result<readonly DownloadTarget[] | null, string> {
  const captured = CAPTURED_FILES[source.id];
  if (captured !== undefined) return ok(captured);
  const urls = sourceFileUrls(source);
  if (!urls.ok) return urls;
  if (urls.value === null) return ok(null);
  return ok(urls.value.map((url) => ({ url, name: downloadName(url) })));
}

/** The URLs of the files of a source not read from a capture. */
function sourceFileUrls(
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
      `${source.id}: its URL is a GitHub folder; list its files in TREE_FILES of src/importers/source-files.ts`,
    );
  }
  const folder = pinned.path === "" ? "" : `${pinned.path}/`;
  return ok(files.map((file) => rawUrl(pinned, `${folder}${file}`)));
}
