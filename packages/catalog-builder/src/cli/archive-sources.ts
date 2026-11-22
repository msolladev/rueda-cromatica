/**
 * Archives every source (docs/04 §9, ADR-0015, ADR-0032): looks for a capture
 * of its URL in the Wayback Machine, or asks for one, and downloads its files
 * to a folder outside the repository, noting their SHA-256 in its source file.
 * Run on demand, never in the build nor in the CI:
 *
 *   CATALOG_SOURCES_DIR=<folder> pnpm --filter @chromatic-wheel/catalog-builder archive-sources
 *
 * Only what is missing is done, so it can run again until nothing is: what
 * still fails after its retries is listed at the end. The Wayback Machine is
 * asked at most once every 5 s, and no more in the run once it stops
 * answering. Asking for a capture needs the archive.org S3 keys in
 * `~/.config/internetarchive/ia.ini`, readable only by its owner; never in an
 * environment variable.
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { isDeepStrictEqual } from "node:util";
import { err, ok, type Result } from "@chromatic-wheel/domain";
import {
  applyArchive,
  captureUrl,
  cdxQuery,
  describeRequestFailure,
  parseCdx,
  parseIaConfig,
  parseJobStatus,
  parseSaveAnswer,
  planArchive,
  retryWait,
  s3Authorization,
  saveRequest,
  sha256,
  statusRequest,
  WAYBACK_GAP_MS,
  type CaptureFailure,
  type RequestFailure,
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
const WAYBACK_ORIGIN = "https://web.archive.org";
/** A generic client name, with nothing about whoever runs it. */
const USER_AGENT = "chromatic-wheel-catalog-builder (archive-sources)";
/** The longest a single request may take. */
const REQUEST_TIMEOUT_MS = 60_000;
/** Save Page Now 2 takes up to 2 minutes per capture. */
const CAPTURE_TIMEOUT_MS = 120_000;

// ── Requests ─────────────────────────────────────────────────

let lastWaybackRequest = Number.NEGATIVE_INFINITY;

/** Waits until the Wayback Machine may be asked again. */
async function pace(url: string): Promise<void> {
  if (new URL(url).origin !== WAYBACK_ORIGIN) return;
  const wait = lastWaybackRequest + WAYBACK_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastWaybackRequest = Date.now();
}

/** The network cause that `fetch` hides behind «fetch failed». */
function networkCode(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  if (error.name === "TimeoutError") return "timeout";
  const cause: unknown = error.cause;
  return typeof cause === "object" && cause !== null && "code" in cause
    ? String(cause.code)
    : null;
}

/** One attempt: any answer but a 429 or a 5xx, or why there is none. */
async function once(
  url: string,
  init: RequestInit,
): Promise<Result<Response, RequestFailure>> {
  await pace(url);
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string>),
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status !== 429 && response.status < 500) return ok(response);
    await response.body?.cancel();
    return err({
      kind: "http",
      status: response.status,
      retryAfter: response.headers.get("Retry-After"),
    });
  } catch (error) {
    return err({ kind: "network", code: networkCode(error) });
  }
}

/**
 * A request, attempted again after what may pass (`retryWait`). An error
 * means the server is not answering; a 4xx is an answer, for the caller.
 */
async function request(
  url: string,
  init: RequestInit = {},
): Promise<Result<Response, RequestFailure>> {
  for (let attempt = 1; ; attempt++) {
    const result = await once(url, init);
    if (result.ok) return result;
    const wait = retryWait(result.error, attempt, new Date());
    if (wait === null) return result;
    console.log(
      `  … ${describeRequestFailure(result.error)}; trying again in ${String(Math.round(wait / 1000))} s`,
    );
    await sleep(wait);
  }
}

// ── Steps ────────────────────────────────────────────────────

/** Why a step failed, and whether it was because the server stopped answering. */
interface StepFailure {
  readonly message: string;
  readonly unavailable: boolean;
}

const unavailable = (what: string, failure: RequestFailure): StepFailure => ({
  message: `${what}: ${describeRequestFailure(failure)}`,
  unavailable: true,
});

const refused = (message: string): StepFailure => ({
  message,
  unavailable: false,
});

const describeCapture = (failure: CaptureFailure): string =>
  failure.code === null
    ? failure.message
    : `${failure.code}: ${failure.message}`;

/** The folder of the downloads, outside the repository, or why not. */
function downloadsFolder(): Result<string, string> {
  const value = process.env[DOWNLOADS_VARIABLE];
  if (value === undefined || value === "") {
    return err(`set ${DOWNLOADS_VARIABLE} to a folder outside the repository`);
  }
  const dir = resolve(value);
  const inside = relative(REPO_DIR, dir);
  if (inside === "" || (!inside.startsWith("..") && !isAbsolute(inside))) {
    return err(`${DOWNLOADS_VARIABLE} (${dir}) is inside the repository`);
  }
  return ok(dir);
}

/** The `Authorization` header from `ia.ini`, or why it cannot be used. */
async function authorization(): Promise<Result<string, string>> {
  try {
    const { mode } = await stat(IA_CONFIG);
    if ((mode & 0o077) !== 0) {
      return err(
        `${IA_CONFIG} can be read by other users; run chmod 600 on it`,
      );
    }
    const keys = parseIaConfig(await readFile(IA_CONFIG, "utf8"));
    if (keys === null) {
      return err(`${IA_CONFIG} has no access and secret in its [s3] section`);
    }
    return ok(s3Authorization(keys.access, keys.secret));
  } catch {
    return err(
      `no ${IA_CONFIG}; create it with the S3 keys of https://archive.org/account/s3.php`,
    );
  }
}

/** The latest capture of `url`, or `null` if there is none. */
async function lookUp(
  url: string,
): Promise<Result<string | null, StepFailure>> {
  const answer = await request(cdxQuery(url));
  if (!answer.ok) return err(unavailable("CDX API", answer.error));
  if (!answer.value.ok) {
    return err(refused(`CDX API: HTTP ${String(answer.value.status)}`));
  }
  const found = parseCdx(await answer.value.json().catch(() => null), url);
  return found.ok ? ok(found.value) : err(refused(found.error));
}

/** Asks Save Page Now 2 for a capture of `url` and waits for it. */
async function capture(
  url: string,
  auth: string,
): Promise<Result<string, StepFailure>> {
  const save = saveRequest(url, auth);
  const answer = await request(save.url, save.init);
  if (!answer.ok) return err(unavailable("Save Page Now", answer.error));
  const job = parseSaveAnswer(await answer.value.json().catch(() => null));
  if (!job.ok) {
    return err(
      refused(
        `Save Page Now refused it, ${describeCapture(job.error)} (HTTP ${String(answer.value.status)})`,
      ),
    );
  }
  // Each poll waits its turn in `pace`: one every 5 s.
  const deadline = Date.now() + CAPTURE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const status = statusRequest(job.value, auth);
    const polled = await request(status.url, status.init);
    if (!polled.ok) return err(unavailable("Save Page Now", polled.error));
    const result = parseJobStatus(await polled.value.json().catch(() => null));
    if (result.kind === "success") {
      return ok(captureUrl(result.timestamp, url));
    }
    if (result.kind === "error") {
      return err(
        refused(`Save Page Now failed, ${describeCapture(result.failure)}`),
      );
    }
  }
  return err(
    refused(
      `Save Page Now job ${job.value} still pending after 2 minutes; if it ends, the next run finds its capture`,
    ),
  );
}

/** The capture of `url`: the latest one, or a new one. */
async function archive(
  url: string,
  auth: () => Promise<Result<string, string>>,
): Promise<Result<{ url: string; isNew: boolean }, StepFailure>> {
  const found = await lookUp(url);
  if (!found.ok) return found;
  if (found.value !== null) return ok({ url: found.value, isNew: false });
  const keys = await auth();
  if (!keys.ok) {
    return err(refused(`no capture, and cannot ask for one: ${keys.error}`));
  }
  const made = await capture(url, keys.value);
  return made.ok ? ok({ url: made.value, isNew: true }) : made;
}

/** Downloads `url` to `path` and gives its SHA-256. */
async function download(
  url: string,
  path: string,
): Promise<Result<string, string>> {
  const answer = await request(url);
  if (!answer.ok) return err(describeRequestFailure(answer.error));
  if (!answer.value.ok) return err(`HTTP ${String(answer.value.status)}`);
  const bytes = new Uint8Array(await answer.value.arrayBuffer());
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  return ok(sha256(bytes));
}

// ── The run ──────────────────────────────────────────────────

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

  /** What is still missing, by source. */
  const missing = new Map<string, string[]>();
  /** Why the Wayback Machine is no longer asked in this run. */
  let waybackDown: string | null = null;
  let keys: Promise<Result<string, string>> | undefined;
  const auth = (): Promise<Result<string, string>> =>
    (keys ??= authorization());

  for (const file of curated.value.sources) {
    const id = file.source.id;
    const pending: string[] = [];
    missing.set(id, pending);
    const fail = (message: string): void => {
      pending.push(message);
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

    // 1. The capture: an existing one, or a new one. Once the Wayback
    //    Machine stops answering, insisting is what gets an IP blocked.
    let archiveUrl: string | null = null;
    if (toCapture !== null && waybackDown !== null) {
      fail("capture: not asked, the Wayback Machine stopped answering");
    } else if (toCapture !== null) {
      const captured = await archive(toCapture, auth);
      if (captured.ok) {
        archiveUrl = captured.value.url;
        console.log(
          `  ${captured.value.isNew ? "+ new" : "= existing"} capture ${archiveUrl}`,
        );
      } else {
        if (captured.error.unavailable) waybackDown = captured.error.message;
        fail(`capture: ${captured.error.message}`);
      }
    }

    // 2. The files, with their SHA-256. Independent of the capture.
    const downloaded: SourceDownload[] = [];
    if (downloads.length > 0) {
      const folder = downloadsFolder();
      if (!folder.ok) {
        fail(
          `${String(downloads.length)} file(s) not downloaded: ${folder.error}`,
        );
      } else {
        for (const target of downloads) {
          const path = join(folder.value, id, target.name);
          const hash = await download(target.url, path);
          if (hash.ok) {
            downloaded.push({ ...target, sha256: hash.value });
            console.log(`  + ${path}`);
          } else {
            fail(`file ${target.name}: ${hash.error}`);
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
      if (pending.length === 0) console.log("  up to date");
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

  console.log("\nResult:");
  for (const [id, pending] of missing) {
    console.log(`  ${pending.length === 0 ? "✓" : "✗"} ${id}`);
    for (const message of pending) console.log(`      ${message}`);
  }
  if (waybackDown !== null) {
    console.log(
      `\nThe Wayback Machine stopped answering (${waybackDown}), so it was not asked again. If it refuses connections, it may have blocked this IP for about an hour.`,
    );
  }
  const left = [...missing.values()].filter((p) => p.length > 0).length;
  if (left > 0) {
    console.log(
      `\n${String(left)} source(s) incomplete; what is missing stays empty in their files. Run the same command again later: it only does what is missing.`,
    );
  }
  console.log("\nNext: pnpm format, then build-catalog, and review the diff.");
  return left > 0 ? 1 : 0;
}

process.exitCode = await main();
