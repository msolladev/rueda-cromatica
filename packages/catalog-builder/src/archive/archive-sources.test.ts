import { describe, expect, it } from "vitest";
import { readSourceFile } from "../curated/files.ts";
import { acmeSource, valid } from "../fixtures.ts";
import {
  applyArchive,
  cdxQuery,
  downloadName,
  parseCdx,
  parseIaConfig,
  parseJobStatus,
  parseSaveAnswer,
  planArchive,
  s3Authorization,
  saveRequest,
  sha256,
} from "./archive-sources.ts";

// The fictitious Acme chart, with its official PDF as its only file.
const PDF = "https://example.com/acme/Acme%20Chart.pdf";
const source = () => valid(readSourceFile(acmeSource()));
const download = { url: PDF, name: "Acme Chart.pdf", sha256: "0".repeat(64) };

describe("planArchive", () => {
  it("asks for the capture and every file of a source with none", () => {
    expect(valid(planArchive(source(), [PDF]))).toEqual({
      capture: "https://example.com/acme",
      kept: [],
      downloads: [{ url: PDF, name: "Acme Chart.pdf" }],
      stale: [],
    });
  });

  it("does nothing more on a second run (ADR-0015)", () => {
    const file = source();
    const done = {
      ...file,
      source: {
        ...file.source,
        archiveUrl:
          "https://web.archive.org/web/20261122120000/https://example.com/acme",
      },
      files: [download],
    };
    expect(valid(planArchive(done, [PDF]))).toEqual({
      capture: null,
      kept: [download],
      downloads: [],
      stale: [],
    });
  });

  it("drops a file that the source no longer has, such as an old revision", () => {
    const file = { ...source(), files: [download] };
    const next = "https://example.com/acme/Acme%20Chart%202.pdf";
    expect(valid(planArchive(file, [next]))).toMatchObject({
      kept: [],
      downloads: [{ url: next, name: "Acme Chart 2.pdf" }],
      stale: [download],
    });
  });

  it("captures nothing for a printed source", () => {
    const file = source();
    const printed = { ...file, source: { ...file.source, url: null } };
    expect(valid(planArchive(printed, null))).toEqual({
      capture: null,
      kept: [],
      downloads: [],
      stale: [],
    });
  });

  it("fails if two files would get the same name", () => {
    const result = planArchive(source(), [
      "https://example.com/a/chart.pdf",
      "https://example.com/b/chart.pdf",
    ]);
    expect(result).toEqual({
      ok: false,
      error: "acme-chart: two of its files are named chart.pdf",
    });
  });
});

describe("downloadName", () => {
  it("is the last segment of the URL, decoded", () => {
    expect(
      downloadName(
        "https://raw.githubusercontent.com/DonnervS/miniature-paints/7097a03e4fe2cf9b815a5a5a4eab85478a14737b/paints/json/AK.json",
      ),
    ).toBe("AK.json");
    expect(downloadName(PDF)).toBe("Acme Chart.pdf");
  });
});

describe("sha256", () => {
  it("is the hex SHA-256 of the bytes", () => {
    expect(sha256(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("CDX lookup", () => {
  const url = "https://example.com/acme";

  it("asks for the latest capture of the exact URL that answered 200", () => {
    const query = new URL(cdxQuery(url));
    expect(query.origin + query.pathname).toBe(
      "https://web.archive.org/cdx/search/cdx",
    );
    expect(Object.fromEntries(query.searchParams)).toEqual({
      url,
      output: "json",
      fl: "timestamp",
      filter: "statuscode:200",
      limit: "-1",
    });
  });

  it("gives the playback URL of the capture, or null without one", () => {
    expect(valid(parseCdx([["timestamp"], ["20261122120000"]], url))).toBe(
      "https://web.archive.org/web/20261122120000/https://example.com/acme",
    );
    expect(valid(parseCdx([], url))).toBeNull();
    expect(valid(parseCdx([["timestamp"]], url))).toBeNull();
  });

  it("fails on an answer it does not understand", () => {
    expect(parseCdx({ error: "x" }, url).ok).toBe(false);
    expect(parseCdx([["timestamp"], ["2026"]], url).ok).toBe(false);
  });
});

describe("Save Page Now 2", () => {
  const authorization = s3Authorization(
    "fictitious-access",
    "fictitious-secret",
  );

  it("posts the URL with the S3 keys and asks for JSON", () => {
    const { url, init } = saveRequest(
      "https://example.com/acme",
      authorization,
    );
    expect(url).toBe("https://web.archive.org/save");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Accept: "application/json",
      Authorization: "LOW fictitious-access:fictitious-secret",
    });
    expect(init.body).toBe("url=https%3A%2F%2Fexample.com%2Facme");
  });

  it("reads the job of the capture, or why it was refused", () => {
    expect(
      parseSaveAnswer({ url: "https://example.com/acme", job_id: "spn2-1" }),
    ).toEqual({ ok: true, value: "spn2-1" });
    expect(
      parseSaveAnswer({
        status: "error",
        status_ext: "error:too-many-daily-captures",
        message: "This URL has been captured 10 times today.",
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "error:too-many-daily-captures",
        message: "This URL has been captured 10 times today.",
      },
    });
    expect(parseSaveAnswer("<html>")).toEqual({
      ok: false,
      error: { code: null, message: "Save Page Now did not start the capture" },
    });
  });

  it("reads the status of the job", () => {
    expect(parseJobStatus({ status: "pending" })).toEqual({ kind: "pending" });
    expect(
      parseJobStatus({
        status: "success",
        timestamp: "20261122120000",
        original_url: "https://example.com/acme",
      }),
    ).toEqual({ kind: "success", timestamp: "20261122120000" });
    expect(
      parseJobStatus({
        status: "error",
        status_ext: "error:blocked-url",
        message: "This URL is in the block list.",
      }),
    ).toEqual({
      kind: "error",
      failure: {
        code: "error:blocked-url",
        message: "This URL is in the block list.",
      },
    });
  });
});

describe("applyArchive", () => {
  it("writes the capture and the files in the order of the source", () => {
    const second = "https://example.com/acme/b.pdf";
    const b = { url: second, name: "b.pdf", sha256: "1".repeat(64) };
    const content = applyArchive(
      source(),
      {
        archiveUrl:
          "https://web.archive.org/web/20261122120000/https://example.com/acme",
        files: [b, download],
      },
      [PDF, second],
    );
    expect(content.source.archiveUrl).toBe(
      "https://web.archive.org/web/20261122120000/https://example.com/acme",
    );
    expect(content.files).toEqual([download, b]);
    expect(Object.keys(content)).toEqual([
      "source",
      "disabled",
      "files",
      "paints",
      "ignoredGroups",
      "ignoredKeys",
    ]);
    expect(
      readSourceFile({ name: "sources/acme-chart.json", content }).ok,
    ).toBe(true);
  });

  it("keeps an existing capture", () => {
    const file = source();
    const archiveUrl =
      "https://web.archive.org/web/20250101000000/https://example.com/acme";
    const content = applyArchive(
      { ...file, source: { ...file.source, archiveUrl } },
      { archiveUrl: null, files: [] },
      [],
    );
    expect(content.source.archiveUrl).toBe(archiveUrl);
  });
});

describe("parseIaConfig", () => {
  it("reads the S3 keys of the [s3] section", () => {
    const text = [
      "[cookies]",
      "logged-in-user = fictitious",
      "",
      "[s3]",
      "access = fictitious-access",
      "secret = fictitious-secret",
    ].join("\n");
    expect(parseIaConfig(text)).toEqual({
      access: "fictitious-access",
      secret: "fictitious-secret",
    });
  });

  it("gives null without both keys in [s3]", () => {
    expect(parseIaConfig("[s3]\naccess = fictitious-access\n")).toBeNull();
    expect(parseIaConfig("[other]\naccess = a\nsecret = b\n")).toBeNull();
    expect(parseIaConfig("[s3]\naccess =\nsecret = b\n")).toBeNull();
  });
});
