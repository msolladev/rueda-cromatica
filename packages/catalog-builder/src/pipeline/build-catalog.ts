/**
 * Builder process (docs/04 §6): reads the curated files, resolves the keys of
 * every source row, chooses each paint's colour among the candidates of its
 * rows, turns the equivalences of the charts into edges, takes the
 * replacements from the manufacturer documents and assembles the
 * `catalog.json` document, without the disabled sources. Then validates it
 * with `parseCatalog` and serialises it
 * deterministically (docs/02 §1), with the report of colour discrepancies and
 * the summary of the disabled sources. Pure: the curated data arrives already
 * read and validated.
 */
import { createHash } from "node:crypto";
import {
  compareSortKeys,
  err,
  idSortKey,
  ok,
  parseCatalog,
  SUPPORTED_SCHEMA_VERSION,
  type CatalogDocument,
  type Paint,
  type PaintId,
  type Result,
  type SourceId,
} from "@chromatic-wheel/domain";
import type { Curated, DataIssue } from "../model/curated.ts";
import { checkColorPolicy, selectColor, type ColorIssue } from "./color.ts";
import {
  colorChange,
  replacementChange,
  type ColorChange,
  type DisabledSourcesReport,
  type ReplacementChange,
} from "./disabled-sources.ts";
import { colorDiscrepancies, type Discrepancy } from "./discrepancies.ts";
import { officialEquivalences } from "./equivalences.ts";
import { replacementClaims, selectReplacement } from "./replacements.ts";
import { resolveKeys } from "./resolve.ts";

export interface BuiltCatalog {
  readonly document: CatalogDocument;
  /** Exact content of `catalog.json`. */
  readonly json: string;
  /** The colour discrepancies between sources, sorted by paint ID. */
  readonly discrepancies: readonly Discrepancy[];
  /** Exact content of the discrepancy report. */
  readonly discrepanciesJson: string;
  /** What the disabled sources change (ADR-0032). */
  readonly disabledSources: DisabledSourcesReport;
  /** Exact content of the summary of the disabled sources. */
  readonly disabledSourcesJson: string;
}

/** Where an entity of the assembled catalog comes from, to report issues. */
interface Origin {
  readonly file: string;
  readonly path: string;
}

interface Located<T> {
  readonly item: T;
  readonly origin: Origin;
}

export function buildCatalog(
  curated: Curated,
): Result<BuiltCatalog, readonly DataIssue[]> {
  // 1. Every file was loaded and checked by `readCurated` (docs/04 §6).
  const { sources: sourceFiles, brands: brandFiles } = curated;
  const { policy } = curated.policy;

  // 2. Key resolution: every row has one paint or is ignored.
  const resolution = resolveKeys(curated);
  const issues: DataIssue[] = [
    ...resolution.issues,
    ...checkColorPolicy(policy, sourceFiles).map((message) => ({
      file: curated.policy.name,
      path: "",
      message,
    })),
  ];

  // 3. The catalog paints, with the colour chosen among the candidates of
  // the enabled sources. With some source disabled, also with every source
  // enabled, for the summary (ADR-0032).
  const disabled = new Set<SourceId>(
    sourceFiles.filter((f) => f.disabled !== null).map((f) => f.source.id),
  );
  const enabledFiles = sourceFiles.filter((f) => !disabled.has(f.source.id));
  const claims = replacementClaims(enabledFiles, resolution.owners);
  const allClaims = replacementClaims(sourceFiles, resolution.owners);
  const paintItems: Located<Paint>[] = [];
  const discrepancies: Discrepancy[] = [];
  const colorChanges: ColorChange[] = [];
  const replacementChanges: ReplacementChange[] = [];
  for (const file of brandFiles) {
    file.paints.forEach((curated, i) => {
      const origin = { file: file.name, path: `paints[${String(i)}]` };
      const rows = resolution.rows.get(curated.id) ?? [];
      const report = (prefix: string, found: readonly ColorIssue[]): void => {
        for (const issue of found) {
          const path = issue.path === "" ? "" : `.${issue.path}`;
          issues.push({
            ...origin,
            path: `${origin.path}${path}`,
            message: `${prefix}${issue.message}`,
          });
        }
      };
      const selection = selectColor(rows, policy, curated, disabled);
      const ifEnabled =
        disabled.size === 0 ? selection : selectColor(rows, policy, curated);
      if (!ifEnabled.ok && ifEnabled !== selection) {
        report("With the disabled sources enabled: ", ifEnabled.error);
      }
      const replacement = selectReplacement(
        curated,
        claims.get(curated.id) ?? [],
      );
      const replacementIfEnabled =
        disabled.size === 0
          ? replacement
          : selectReplacement(curated, allClaims.get(curated.id) ?? []);
      if (!replacementIfEnabled.ok && replacementIfEnabled !== replacement) {
        report(
          "With the disabled sources enabled: ",
          replacementIfEnabled.error,
        );
      }
      if (!replacement.ok) report("", replacement.error);
      if (!selection.ok) report("", selection.error);
      if (!selection.ok || !replacement.ok) return;
      if (replacementIfEnabled.ok) {
        const change = replacementChange(
          curated.id,
          replacement.value,
          replacementIfEnabled.value,
        );
        if (change !== null) replacementChanges.push(change);
      }
      const { color, others } = selection.value;
      discrepancies.push(...colorDiscrepancies(curated.id, color, others));
      if (ifEnabled.ok) {
        const change = colorChange(curated.id, color, ifEnabled.value.color);
        if (change !== null) colorChanges.push(change);
      }
      // Key order of docs/02 §3.
      const item: Paint = {
        id: curated.id,
        rangeId: curated.rangeId,
        name: curated.name,
        aliases: curated.aliases,
        manufacturerCode: curated.manufacturerCode,
        type: curated.type,
        metallic: curated.metallic,
        color,
        status:
          curated.status.kind === "active"
            ? curated.status
            : { kind: "discontinued", replacement: replacement.value },
      };
      paintItems.push({ item, origin });
    });
  }
  if (issues.length > 0) return err(issues);

  // 4. Assemble and sort (docs/02 §1).
  const sources = sorted(
    sourceFiles
      .filter((file) => !disabled.has(file.source.id))
      .map((file) => ({
        item: file.source,
        origin: { file: file.name, path: "source" },
      })),
  );
  const brands = sorted(
    brandFiles.map((file) => ({
      item: file.brand,
      origin: { file: file.name, path: "brand" },
    })),
  );
  const ranges = sorted(
    brandFiles.flatMap((file) =>
      file.ranges.map((item, i) => ({
        item,
        origin: { file: file.name, path: `ranges[${String(i)}]` },
      })),
    ),
  );
  const paints = sorted(paintItems);
  const equivalences = officialEquivalences(enabledFiles, resolution.owners);
  // The edges that the disabled sources take away (ADR-0032).
  const lostEquivalences = officialEquivalences(
    sourceFiles.filter((f) => disabled.has(f.source.id)),
    resolution.owners,
  );

  // Key order follows docs/02.
  const body = {
    sources: sources.map((s) => s.item),
    brands: brands.map((b) => b.item),
    ranges: ranges.map((r) => r.item),
    paints: paints.map((p) => p.item),
    equivalences,
  };

  // 5. Meta (docs/02 §4).
  const document = {
    meta: { schemaVersion: SUPPORTED_SCHEMA_VERSION, dataVersion: hash(body) },
    ...body,
  };

  // 6. Final validation, with issues located in their files.
  const parsed = parseCatalog(document);
  if (!parsed.ok) {
    if (parsed.error.kind === "unsupported-schema-version") {
      throw new Error("Builder bug: wrote an unsupported schema version");
    }
    const origins = { sources, brands, ranges, paints };
    return err(parsed.error.issues.map((issue) => locate(issue, origins)));
  }

  // 7. Deterministic serialisation (docs/02 §1), and the discrepancy report
  // in the same order as the paints.
  const order = new Map(paints.map((p, i) => [p.item.id, i]));
  const byPaint = (
    a: { readonly paintId: PaintId },
    b: { readonly paintId: PaintId },
  ): number => (order.get(a.paintId) ?? 0) - (order.get(b.paintId) ?? 0);
  const report = [...discrepancies].sort(byPaint);
  const disabledSources: DisabledSourcesReport = {
    disabledSources: [...disabled].sort(),
    colors: [...colorChanges].sort(byPaint),
    equivalences: lostEquivalences,
    replacements: [...replacementChanges].sort(byPaint),
  };
  return ok({
    document,
    json: serialise(document),
    discrepancies: report,
    discrepanciesJson: serialise(report),
    disabledSources,
    disabledSourcesJson: serialise(disabledSources),
  });
}

function serialise(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sorted<T extends { readonly id: string }>(
  items: readonly Located<T>[],
): readonly Located<T>[] {
  return [...items].sort((a, b) =>
    compareSortKeys(idSortKey(a.item), idSortKey(b.item)),
  );
}

/** `dataVersion`: SHA-256 of the compact JSON of everything but `meta`. */
function hash(body: object): string {
  const digest = createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex");
  return `sha256:${digest}`;
}

const COLLECTION_PATH = /^(sources|brands|ranges|paints)\[(\d+)\](.*)$/;

/** Turns `paints[12].color` into the file and path where that paint lives. */
function locate(
  issue: { readonly path: string; readonly message: string },
  origins: Readonly<
    Record<
      "sources" | "brands" | "ranges" | "paints",
      readonly Located<unknown>[]
    >
  >,
): DataIssue {
  const match = COLLECTION_PATH.exec(issue.path);
  const [, collection, index, rest] = match ?? [];
  const origin =
    collection === undefined || index === undefined
      ? undefined
      : origins[collection as keyof typeof origins][Number(index)]?.origin;
  return origin === undefined
    ? { file: "catalog.json", path: issue.path, message: issue.message }
    : {
        file: origin.file,
        path: `${origin.path}${rest ?? ""}`,
        message: issue.message,
      };
}
