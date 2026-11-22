/**
 * Archives every source (docs/04 §9, ADR-0015, ADR-0032): looks for a capture
 * of its URL in the Wayback Machine, or asks for one, and downloads its files
 * to a folder outside the repository, noting their SHA-256 in its source file.
 * Run on demand, never in the build nor in the CI:
 *
 *   CATALOG_SOURCES_DIR=<folder> pnpm --filter @chromatic-wheel/catalog-builder archive-sources
 *
 * Only what is missing is done, so it can run again: a failure is shown and
 * left for the next run. Asking for a capture needs the archive.org S3 keys
 * in `~/.config/internetarchive/ia.ini`, readable only by its owner; never in
 * an environment variable.
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { isDeepStrictEqual } from "node:util";
import {
  applyArchive,
  captureUrl,
  cdxQuery,
  parseCdx,
  parseIaConfig,
  parseJobStatus,
  parseSaveAnswer,
  planArchive,
  s3Authorization,
  saveRequest,
  sha256,
  statusRequest,
  type CaptureFailure,
} from "../archive/archive-sources.ts";
import {
  readCurated,
  readSourceFile,
  sourceContent,
  type SourceDownload,
} from "../curated/files.ts";
import {
  dataPath,
  printIssues,
  readCuratedFiles,
  REPO_DIR,
  writeDataFile,
} from "./data-files.ts";
import { sourceFileUrls } from "./source-files.ts";

const DOWNLOADS_VARIABLE = "CATALOG_SOURCES_DIR";
const IA_CONFIG = join(homedir(), ".config/internetarchive/ia.ini");
/** A generic client name, with nothing about whoever runs it. */
const USER_AGENT = "chromatic-wheel-catalog-builder (archive-sources)";
/** Save Page Now 2 takes up to 2 minutes per capture; its status, every 5 s. */
const POLL_EVERY_MS = 5_000;
const POLL_FOR_MS = 120_000;

const request = (url: string, init: RequestInit = {}): Promise<Response> =>
  fetch(url, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string>),
      "User-Agent": USER_AGENT,
    },
  });

const describe = (failure: CaptureFailure): string =>
  failure.code === null
    ? failure.message
    : `${failure.code}: ${failure.message}`;

/** The folder of the downloads, outside the repository, or why not. */
function downloadsFolder(): { dir: string } | { error: string } {
  const value = process.env[DOWNLOADS_VARIABLE];
  if (value === undefined || value === "") {
    return {
      error: `Set ${DOWNLOADS_VARIABLE} to a folder outside the repository`,
    };
  }
  const dir = resolve(value);
  const inside = relative(REPO_DIR, dir);
  if (inside === "" || (!inside.startsWith("..") && !isAbsolute(inside))) {
    return { error: `${DOWNLOADS_VARIABLE} (${dir}) is inside the repository` };
  }
  return { dir };
}

/** The `Authorization` header from `ia.ini`, or why it cannot be used. */
async function authorization(): Promise<{ value: string } | { error: string }> {
  try {
    const { mode } = await stat(IA_CONFIG);
    if ((mode & 0o077) !== 0) {
      return {
        error: `${IA_CONFIG} can be read by other users; run chmod 600 on it`,
      };
    }
    const keys = parseIaConfig(await readFile(IA_CONFIG, "utf8"));
    if (keys === null) {
      return {
        error: `${IA_CONFIG} has no access and secret in its [s3] section`,
      };
    }
    return { value: s3Authorization(keys.access, keys.secret) };
  } catch {
    return {
      error: `No ${IA_CONFIG}; create it with the S3 keys of https://archive.org/account/s3.php`,
    };
  }
}

/** The latest capture of `url`, or `null` if there is none. */
async function lookUp(url: string): Promise<string | null> {
  const response = await request(cdxQuery(url));
  if (!response.ok) throw new Error(`CDX API: HTTP ${String(response.status)}`);
  const found = parseCdx(await response.json(), url);
  if (!found.ok) throw new Error(found.error);
  return found.value;
}

/** Asks Save Page Now 2 for a capture of `url` and waits for it. */
async function capture(
  url: string,
  auth: string,
): Promise<{ archiveUrl: string } | { failure: CaptureFailure }> {
  const save = saveRequest(url, auth);
  const answer = await request(save.url, save.init);
  const job = parseSaveAnswer(await answer.json().catch(() => null));
  if (!job.ok) {
    return {
      failure: {
        ...job.error,
        message: `${job.error.message} (HTTP ${String(answer.status)})`,
      },
    };
  }
  for (let waited = 0; waited < POLL_FOR_MS; waited += POLL_EVERY_MS) {
    await sleep(POLL_EVERY_MS);
    const status = statusRequest(job.value, auth);
    const response = await request(status.url, status.init);
    const result = parseJobStatus(await response.json().catch(() => null));
    if (result.kind === "success") {
      return { archiveUrl: captureUrl(result.timestamp, url) };
    }
    if (result.kind === "error") return { failure: result.failure };
  }
  return {
    failure: {
      code: null,
      message: `Job ${job.value} still pending after 2 minutes`,
    },
  };
}

async function main(): Promise<number> {
  const files = await readCuratedFiles();
  if (!files.ok) {
    for (const message of files.error) console.error(message);
    return 1;
  }
  const curated = readCurated(files.value.data);
  if (!curated.ok) {
    printIssues(curated.error);
    return 1;
  }

  const failures: string[] = [];
  let auth: Promise<{ value: string } | { error: string }> | undefined;
  for (const file of curated.value.sources) {
    const id = file.source.id;
    const fail = (message: string): void => {
      failures.push(`${id}: ${message}`);
      console.error(`  ✗ ${message}`);
    };
    console.log(id);
    const urls = sourceFileUrls(file.source);
    if (!urls.ok) {
      fail(urls.error);
      continue;
    }
    const plan = planArchive(file, urls.value);
    if (!plan.ok) {
      fail(plan.error);
      continue;
    }
    const { capture: toCapture, kept, downloads, stale } = plan.value;

    // 1. The capture: an existing one, or a new one.
    let archiveUrl: string | null = null;
    if (toCapture !== null) {
      try {
        archiveUrl = await lookUp(toCapture);
        if (archiveUrl === null) {
          auth ??= authorization();
          const keys = await auth;
          if ("error" in keys) {
            fail(`no capture yet, and cannot ask for one: ${keys.error}`);
          } else {
            const result = await capture(toCapture, keys.value);
            if ("failure" in result)
              fail(`capture refused, ${describe(result.failure)}`);
            else archiveUrl = result.archiveUrl;
            if (archiveUrl !== null)
              console.log(`  + new capture ${archiveUrl}`);
          }
        } else {
          console.log(`  = existing capture ${archiveUrl}`);
        }
      } catch (error) {
        fail(
          `Wayback Machine: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // 2. The files, with their SHA-256. Independent of the capture.
    const downloaded: SourceDownload[] = [];
    if (downloads.length > 0) {
      const folder = downloadsFolder();
      if ("error" in folder) {
        fail(
          `cannot download ${String(downloads.length)} file(s): ${folder.error}`,
        );
      } else {
        const dir = join(folder.dir, id);
        for (const target of downloads) {
          try {
            const response = await request(target.url);
            if (!response.ok)
              throw new Error(`HTTP ${String(response.status)}`);
            const bytes = new Uint8Array(await response.arrayBuffer());
            await mkdir(dir, { recursive: true });
            await writeFile(join(dir, target.name), bytes);
            downloaded.push({ ...target, sha256: sha256(bytes) });
            console.log(`  + ${join(dir, target.name)}`);
          } catch (error) {
            fail(
              `${target.url}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }
    }
    for (const old of stale)
      console.log(`  - no longer a file of the source: ${old.name}`);

    // 3. The source file, written only if something changed.
    const content = applyArchive(
      file,
      { archiveUrl, files: [...kept, ...downloaded] },
      urls.value ?? [],
    );
    if (isDeepStrictEqual(content, sourceContent(file))) {
      if (failures.every((f) => !f.startsWith(`${id}:`)))
        console.log("  up to date");
      continue;
    }
    const check = readSourceFile({ name: file.name, content });
    if (!check.ok) {
      printIssues(check.error);
      return 1;
    }
    await writeDataFile(file.name, content);
    console.log(`  written ${dataPath(file.name)}`);
  }

  if (failures.length > 0) {
    console.error(
      `\n${String(failures.length)} failure(s), left for the next run.`,
    );
  }
  console.log("\nNext: pnpm format, then build-catalog, and review the diff.");
  return failures.length > 0 ? 1 : 0;
}

process.exitCode = await main();
