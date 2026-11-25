import { describe, expect, it } from "vitest";
import {
  acmeFile,
  acmeSource,
  patchPaint,
  policyFile,
  reasonsFile,
  row,
} from "../fixtures.ts";
import {
  readBrandFile,
  readColorPolicyFile,
  readIgnoreReasonsFile,
  readSourceFile,
  readTombstonesFile,
} from "./files.ts";

const paths = (
  result:
    | { ok: true }
    | { ok: false; error: readonly { file: string; path: string }[] },
) =>
  result.ok ? [] : result.error.map((issue) => `${issue.file} ${issue.path}`);

describe("readSourceFile (docs/04 §3)", () => {
  it("accepts the source, its literal rows and its ignores", () => {
    expect(readSourceFile(acmeSource()).ok).toBe(true);
  });

  it("requires the file name to match the source ID", () => {
    const file = { ...acmeSource(), name: "sources/acme.json" };
    expect(paths(readSourceFile(file))).toEqual([
      "sources/acme.json source.id",
    ]);
  });

  it("keeps hexes in the case of the source, but checks their format", () => {
    const file = acmeSource();
    file.content.paints = [row({ key: "AC-01", hex: "#AbCdEf" })];
    expect(readSourceFile(file).ok).toBe(true);
    file.content.paints = [row({ key: "AC-01", hex: "abcdef" })];
    expect(paths(readSourceFile(file))).toEqual([
      "sources/acme-chart.json paints[0].hex",
    ]);
  });

  it("rejects an equivalence of a row with itself (ADR-0033)", () => {
    const file = acmeSource();
    file.content.equivalences = [{ from: "AC-01", to: "AC-01", note: null }];
    expect(paths(readSourceFile(file))).toEqual([
      "sources/acme-chart.json equivalences[0]",
    ]);
  });

  it("rejects a row with a hex and a gradient", () => {
    const file = acmeSource();
    file.content.paints = [
      row({ key: "AC-01", gradient: { dark: "#000000", light: "#ffffff" } }),
    ];
    expect(paths(readSourceFile(file))).toEqual([
      "sources/acme-chart.json paints[0]",
    ]);
  });

  it("requires the capture to be of the source URL (ADR-0032)", () => {
    const file = acmeSource();
    file.content.source.archiveUrl =
      "https://web.archive.org/web/20261122120000/https://example.com/acme";
    expect(readSourceFile(file).ok).toBe(true);
    // The URL moved to a new revision and the capture is of the old one.
    file.content.source.url = "https://example.com/acme-2";
    expect(paths(readSourceFile(file))).toEqual([
      "sources/acme-chart.json source.archiveUrl",
    ]);
    file.content.source.archiveUrl = "https://web.archive.org/";
    expect(paths(readSourceFile(file))).toEqual([
      "sources/acme-chart.json source.archiveUrl",
    ]);
  });

  it("accepts a disabled source, always with its note", () => {
    const file = acmeSource();
    file.content.disabled = { note: "Fictitious reason." };
    expect(readSourceFile(file).ok).toBe(true);
    file.content.disabled = { note: "" };
    expect(paths(readSourceFile(file))).toEqual([
      "sources/acme-chart.json disabled.note",
    ]);
  });

  it("checks the downloaded files: a hash and a name each, not repeated", () => {
    const file = acmeSource();
    const download = {
      url: "https://example.com/acme.pdf",
      name: "acme.pdf",
      sha256: "0".repeat(64),
    };
    file.content.files = [download];
    expect(readSourceFile(file).ok).toBe(true);
    file.content.files = [download, { ...download, sha256: "ABC" }];
    expect(paths(readSourceFile(file))).toEqual([
      "sources/acme-chart.json files[1].sha256",
    ]);
    file.content.files = [download, { ...download, name: "../acme.pdf" }];
    expect(paths(readSourceFile(file))).toEqual([
      "sources/acme-chart.json files[1].name",
    ]);
    file.content.files = [download, download];
    expect(paths(readSourceFile(file))).toEqual([
      "sources/acme-chart.json files[1].name",
    ]);
  });

  it("rejects unknown fields", () => {
    const file = acmeSource();
    file.content.paints = [{ ...row({ key: "AC-01" }), ean: "0" } as never];
    expect(paths(readSourceFile(file))).toEqual([
      "sources/acme-chart.json paints[0]",
    ]);
  });
});

describe("readBrandFile (docs/04 §4)", () => {
  it("accepts a brand file with its own ranges and paints", () => {
    expect(readBrandFile(acmeFile()).ok).toBe(true);
  });

  it("validates the paints with the catalog rules, without colour", () => {
    const file = acmeFile();
    patchPaint(file, 0, { manufacturerCode: "" });
    expect(paths(readBrandFile(file))).toEqual([
      "brands/acme.json paints[0].manufacturerCode",
    ]);
  });

  it("rejects a colour: it comes from the sources", () => {
    const file = acmeFile();
    patchPaint(file, 0, { color: null } as never);
    expect(paths(readBrandFile(file))).toEqual(["brands/acme.json paints[0]"]);
  });

  it("requires at least one key, and one per source at most", () => {
    const file = acmeFile();
    patchPaint(file, 0, { keys: [] });
    const key = { sourceId: "acme-chart", key: "AC-02" };
    patchPaint(file, 1, { keys: [key, key] });
    expect(paths(readBrandFile(file))).toEqual([
      "brands/acme.json paints[0].keys",
    ]);
    patchPaint(file, 0, { keys: [{ sourceId: "acme-chart", key: "AC-01" }] });
    expect(paths(readBrandFile(file))).toEqual([
      "brands/acme.json paints[1].keys[1]",
    ]);
  });

  it("requires the file name to match the brand ID", () => {
    const file = { ...acmeFile(), name: "brands/acme-paints.json" };
    expect(paths(readBrandFile(file))).toEqual([
      "brands/acme-paints.json brand.id",
    ]);
  });

  it("rejects a range of another brand", () => {
    const file = acmeFile();
    file.content.ranges.push({
      id: "globex/standard",
      brandId: "globex",
      name: "Globex Standard",
      status: "active",
    });
    expect(paths(readBrandFile(file))).toEqual([
      "brands/acme.json ranges[1].brandId",
    ]);
  });

  it("rejects a paint whose range is not in the file", () => {
    const file = acmeFile();
    patchPaint(file, 0, { rangeId: "globex/standard" });
    expect(paths(readBrandFile(file))).toEqual([
      "brands/acme.json paints[0].rangeId",
    ]);
  });
});

describe("readIgnoreReasonsFile (docs/04 §5)", () => {
  it("accepts an ID and a text per reason", () => {
    expect(readIgnoreReasonsFile(reasonsFile()).ok).toBe(true);
  });

  it("rejects a repeated ID", () => {
    const file = reasonsFile();
    file.content.push({ id: "airbrush", text: "Again." });
    expect(paths(readIgnoreReasonsFile(file))).toEqual([
      "ignore-reasons.json [2].id",
    ]);
  });
});

describe("readColorPolicyFile (docs/04 §5)", () => {
  it("accepts the three lists", () => {
    expect(readColorPolicyFile(policyFile()).ok).toBe(true);
  });

  it("puts a source in one hex list at most", () => {
    const file = policyFile();
    file.content.community.push("acme-chart");
    expect(paths(readColorPolicyFile(file))).toEqual([
      "color-policy.json community[0]",
    ]);
  });

  it("lets a source be in the measured list too", () => {
    const file = policyFile();
    file.content.measured.push("acme-chart");
    expect(readColorPolicyFile(file).ok).toBe(true);
  });
});

describe("readTombstonesFile (docs/03 §6)", () => {
  const file = (content: unknown) => ({ name: "tombstones.json", content });
  const empty = { sources: [], brands: [], ranges: [], paints: [] };
  const issuePaths = (content: unknown) => {
    const result = readTombstonesFile(file(content));
    return result.ok ? [] : result.error.map((issue) => issue.path);
  };

  it("accepts an ID and its reason per entry, by collection", () => {
    const paint = {
      id: "acme/core/purple",
      reason: "Registered twice.",
      remainingPaintId: "acme/core/red",
    };
    const result = readTombstonesFile(file({ ...empty, paints: [paint] }));
    expect(result.ok ? result.value.paints : null).toEqual([paint]);
  });

  it("requires a paint's tombstone to say which paint remains, or null (ADR-0037)", () => {
    expect(
      issuePaths({
        ...empty,
        paints: [{ id: "acme/core/purple", reason: "Registered twice." }],
      }),
    ).toEqual(["paints[0].remainingPaintId"]);
    expect(
      issuePaths({
        ...empty,
        brands: [{ id: "initech", reason: "No.", remainingPaintId: null }],
      }),
    ).toEqual(["brands[0]"]);
  });

  it("requires a reason", () => {
    expect(
      issuePaths({ ...empty, brands: [{ id: "initech", reason: " " }] }),
    ).toEqual(["brands[0].reason"]);
  });

  it("validates each ID with the format of its collection", () => {
    expect(
      issuePaths({
        ...empty,
        brands: [{ id: "acme/core", reason: "A range, not a brand." }],
      }),
    ).toEqual(["brands[0].id"]);
  });

  it("requires the four collections and nothing else", () => {
    expect(issuePaths({ paints: [], extra: [] })).toEqual([
      "sources",
      "brands",
      "ranges",
      "",
    ]);
  });

  it("rejects an ID tombstoned twice", () => {
    const entry = { id: "initech", reason: "Not a paint brand." };
    expect(issuePaths({ ...empty, brands: [entry, entry] })).toEqual([
      "brands[1].id",
    ]);
  });
});
