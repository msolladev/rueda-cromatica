/**
 * The pure part of `archive-sources` (docs/04 §9, ADR-0015, ADR-0032): what is
 * missing in each source, the Wayback Machine requests and how their answers
 * are read, and the source file with the results. The network and the disk
 * stay in `cli/archive-sources.ts`.
 *
 * - Lookup: the CDX API, without credentials, for the latest capture of the
 *   exact URL that answered 200.
 * - Capture: Save Page Now 2, with the archive.org S3 keys. It answers a job,
 *   whose status is polled until it succeeds or fails.
 */
import { createHash } from "node:crypto";
import { err, ok, type Result } from "@chromatic-wheel/domain";
import { z } from "zod";
import {
  sourceContent,
  type SourceDownload,
  type SourceFile,
  type SourceFileContent,
} from "../curated/files.ts";

const WAYBACK = "https://web.archive.org";

/** A file to download: where from and its name in the folder of the source. */
export interface DownloadTarget {
  readonly url: string;
  readonly name: string;
}

/** What `archive-sources` has to do for one source. */
export interface ArchivePlan {
  /** The URL to capture, or `null` if it has a capture or no URL. */
  readonly capture: string | null;
  /** The files listed and still expected, kept as they are. */
  readonly kept: readonly SourceDownload[];
  /** The expected files that are not downloaded yet. */
  readonly downloads: readonly DownloadTarget[];
  /** The files listed that the source no longer has, to drop from the list. */
  readonly stale: readonly SourceDownload[];
}

/**
 * The name of a downloaded file: the last segment of its URL, decoded, such
 * as `AK.json` or `CC329-R00.pdf`.
 */
export function downloadName(url: string): string {
  const segment = new URL(url).pathname.split("/").at(-1) ?? "";
  return decodeURIComponent(segment);
}

/**
 * What is missing in a source: its capture if it has none, and the files of
 * `fileUrls` (from `cli/source-files.ts`) not downloaded yet. A file already
 * listed is never downloaded again, so running it twice does nothing more.
 * Fails if two files would get the same name.
 */
export function planArchive(
  file: Pick<SourceFile, "source" | "files">,
  fileUrls: readonly string[] | null,
): Result<ArchivePlan, string> {
  const { url, archiveUrl } = file.source;
  const expected = (fileUrls ?? []).map((u) => ({
    url: u,
    name: downloadName(u),
  }));
  const names = expected.map((t) => t.name);
  const repeated = names.find((name, i) => names.indexOf(name) !== i);
  if (repeated !== undefined) {
    return err(`${file.source.id}: two of its files are named ${repeated}`);
  }
  const listed = (target: DownloadTarget): SourceDownload | undefined =>
    file.files.find((f) => f.url === target.url && f.name === target.name);
  const kept = expected.flatMap((t) => listed(t) ?? []);
  return ok({
    capture: url !== null && archiveUrl === null ? url : null,
    kept,
    downloads: expected.filter((t) => listed(t) === undefined),
    stale: file.files.filter((f) => !kept.includes(f)),
  });
}

/** Hex SHA-256 of a downloaded file. */
export const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

/** The playback URL of a capture: `https://web.archive.org/web/<timestamp>/<url>`. */
export const captureUrl = (timestamp: string, url: string): string =>
  `${WAYBACK}/web/${timestamp}/${url}`;

// ── CDX: the latest capture ──────────────────────────────────

/** The CDX query of the latest capture of exactly `url` that answered 200. */
export function cdxQuery(url: string): string {
  const params = new URLSearchParams({
    url,
    output: "json",
    fl: "timestamp",
    filter: "statuscode:200",
    limit: "-1",
  });
  return `${WAYBACK}/cdx/search/cdx?${params.toString()}`;
}

const timestamp = z.string().regex(/^\d{14}$/);

/**
 * The answer of {@link cdxQuery}: a header row and at most one row with its
 * timestamp, or nothing at all when there is no capture.
 */
const cdxAnswer = z.union([
  z.tuple([]),
  z.tuple([z.tuple([z.literal("timestamp")])]),
  z.tuple([z.tuple([z.literal("timestamp")]), z.tuple([timestamp])]),
]);

/** The playback URL of the capture in a CDX answer, or `null` if there is none. */
export function parseCdx(
  answer: unknown,
  url: string,
): Result<string | null, string> {
  const parsed = cdxAnswer.safeParse(answer);
  if (!parsed.success) return err("Unexpected answer of the CDX API");
  const found = parsed.data[1]?.[0];
  return ok(found === undefined ? null : captureUrl(found, url));
}

// ── Save Page Now 2 ──────────────────────────────────────────

/** The request that asks for a capture of `url`. */
export function saveRequest(
  url: string,
  authorization: string,
): { readonly url: string; readonly init: RequestInit } {
  return {
    url: `${WAYBACK}/save`,
    init: {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: authorization,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ url }).toString(),
    },
  };
}

/** The request that reads the status of a capture job. */
export function statusRequest(
  jobId: string,
  authorization: string,
): { readonly url: string; readonly init: RequestInit } {
  return {
    url: `${WAYBACK}/save/status/${encodeURIComponent(jobId)}`,
    init: {
      headers: { Accept: "application/json", Authorization: authorization },
    },
  };
}

/** The `Authorization` header of the archive.org S3 keys. */
export const s3Authorization = (access: string, secret: string): string =>
  `LOW ${access}:${secret}`;

/** A capture that failed, with the code of Save Page Now if it gives one. */
export interface CaptureFailure {
  /** Such as `error:blocked-url` or `error:too-many-daily-captures`. */
  readonly code: string | null;
  readonly message: string;
}

const failure = z.looseObject({
  status_ext: z.string().optional(),
  message: z.string().optional(),
});

const toFailure = (answer: unknown, fallback: string): CaptureFailure => {
  const parsed = failure.safeParse(answer);
  const code = parsed.success ? (parsed.data.status_ext ?? null) : null;
  const message = parsed.success ? (parsed.data.message ?? fallback) : fallback;
  return { code, message };
};

/** The job of a capture request, or why it was refused. */
export function parseSaveAnswer(
  answer: unknown,
): Result<string, CaptureFailure> {
  const job = z.looseObject({ job_id: z.string().min(1) }).safeParse(answer);
  return job.success
    ? ok(job.data.job_id)
    : err(toFailure(answer, "Save Page Now did not start the capture"));
}

export type JobStatus =
  | { readonly kind: "pending" }
  | { readonly kind: "success"; readonly timestamp: string }
  | { readonly kind: "error"; readonly failure: CaptureFailure };

/** The status of a capture job. */
export function parseJobStatus(answer: unknown): JobStatus {
  const status = z
    .looseObject({ status: z.string(), timestamp: timestamp.optional() })
    .safeParse(answer);
  if (!status.success) {
    return {
      kind: "error",
      failure: toFailure(answer, "Unexpected answer of Save Page Now"),
    };
  }
  const { status: kind, timestamp: done } = status.data;
  if (kind === "pending") return { kind: "pending" };
  if (kind === "success" && done !== undefined) {
    return { kind: "success", timestamp: done };
  }
  return {
    kind: "error",
    failure: toFailure(answer, `Save Page Now answered status ${kind}`),
  };
}

// ── The source file ──────────────────────────────────────────

/**
 * The source file with what this run obtained: the capture, if any, and the
 * files kept plus the ones downloaded, in the order of the source's files.
 */
export function applyArchive(
  file: SourceFile,
  result: {
    readonly archiveUrl: string | null;
    readonly files: readonly SourceDownload[];
  },
  order: readonly string[],
): SourceFileContent {
  const position = (f: SourceDownload): number => order.indexOf(f.url);
  return sourceContent({
    ...file,
    source: {
      ...file.source,
      archiveUrl: file.source.archiveUrl ?? result.archiveUrl,
    },
    files: [...result.files].sort((a, b) => position(a) - position(b)),
  });
}

// ── The archive.org keys ─────────────────────────────────────

/**
 * The S3 keys in the configuration file of the official `ia` tool
 * (`~/.config/internetarchive/ia.ini`): `access` and `secret` in its `[s3]`
 * section. `null` if the section or either key is missing.
 */
export function parseIaConfig(
  text: string,
): { readonly access: string; readonly secret: string } | null {
  let section = "";
  const s3 = new Map<string, string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#") || line.startsWith(";")) continue;
    const header = /^\[(.+)\]$/.exec(line);
    if (header?.[1] !== undefined) {
      section = header[1].trim();
      continue;
    }
    const [, key, value] = /^([^=:]+)[=:](.*)$/.exec(line) ?? [];
    if (section === "s3" && key !== undefined && value !== undefined) {
      s3.set(key.trim(), value.trim());
    }
  }
  const access = s3.get("access");
  const secret = s3.get("secret");
  return access !== undefined &&
    access !== "" &&
    secret !== undefined &&
    secret !== ""
    ? { access, secret }
    : null;
}

// ── Pacing and retries ───────────────────────────────────────

/**
 * The minimum time between two requests to the Wayback Machine, polls
 * included: at most 12 a minute, half of the limit its users report (it
 * publishes none) and the capture limit of Save Page Now 2.
 */
export const WAYBACK_GAP_MS = 5_000;

/** The waits before the second and the third attempt of a request. */
export const RETRY_WAITS_MS: readonly number[] = [30_000, 60_000];

/** The longest `Retry-After` worth waiting for in a run. */
export const MAX_RETRY_AFTER_MS = 120_000;

/** Why one HTTP request failed. */
export type RequestFailure =
  | {
      /** No answer: refused, reset, timed out… */
      readonly kind: "network";
      readonly code: string | null;
    }
  | {
      readonly kind: "http";
      readonly status: number;
      /** The `Retry-After` header, if any. */
      readonly retryAfter: string | null;
    };

/**
 * The milliseconds a `Retry-After` asks to wait, in seconds or as an HTTP
 * date, or `null` if it is not valid.
 */
export function parseRetryAfter(value: string, now: Date): number | null {
  if (/^\d+$/.test(value.trim())) return Number(value.trim()) * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - now.getTime());
}

/**
 * How long to wait before attempting again a request that failed on its
 * `attempt` (1 for the first one), or `null` not to try again. Only what
 * may pass is retried: no answer, a 5xx, or a 429 whose `Retry-After` is at
 * most {@link MAX_RETRY_AFTER_MS}. A 4xx is an answer, never retried.
 */
export function retryWait(
  failure: RequestFailure,
  attempt: number,
  now: Date,
): number | null {
  const wait = RETRY_WAITS_MS[attempt - 1];
  if (wait === undefined) return null;
  if (failure.kind === "network") return wait;
  if (failure.status === 429) {
    const asked =
      failure.retryAfter === null
        ? null
        : parseRetryAfter(failure.retryAfter, now);
    if (asked === null) return wait;
    return asked <= MAX_RETRY_AFTER_MS ? Math.max(asked, wait) : null;
  }
  return failure.status >= 500 ? wait : null;
}

/** A failed request in words, such as `HTTP 503` or `no answer (ECONNREFUSED)`. */
export function describeRequestFailure(failure: RequestFailure): string {
  if (failure.kind === "network") {
    return failure.code === null ? "no answer" : `no answer (${failure.code})`;
  }
  const after =
    failure.retryAfter === null ? "" : `, Retry-After ${failure.retryAfter}`;
  return `HTTP ${String(failure.status)}${after}`;
}
