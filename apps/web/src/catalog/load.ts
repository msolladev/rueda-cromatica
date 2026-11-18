/**
 * Loading the catalog (docs/02 §5, docs/07 §7): read, parse, validate and
 * index. Reading is a port (ADR-0018): today the file of the app, in phase 6
 * the snapshot of the API.
 */
import {
  buildPaintIndex,
  parseCatalog,
  type Catalog,
  type PaintIndex,
} from "@chromatic-wheel/domain";

/** Reads the text of `catalog.json`; rejects on a network or HTTP error. */
export type ReadCatalog = () => Promise<string>;

export type CatalogLoadError =
  /** No network, or the server answered with an error. */
  | { readonly kind: "network"; readonly detail: string }
  /** The catalog is of another schema version: the app is outdated. */
  | {
      readonly kind: "version";
      readonly found: unknown;
      readonly supported: number;
    }
  /** Malformed JSON or a catalog that does not pass the validation. */
  | { readonly kind: "invalid"; readonly detail: string };

export type CatalogLoad =
  | { readonly status: "loading" }
  | {
      readonly status: "ready";
      readonly catalog: Catalog;
      readonly index: PaintIndex;
    }
  | { readonly status: "error"; readonly error: CatalogLoadError };

const MAX_ISSUES = 20;

/** Reads, validates and indexes the catalog. Never rejects. */
export async function loadCatalog(read: ReadCatalog): Promise<CatalogLoad> {
  let text: string;
  try {
    text = await read();
  } catch (error) {
    return failed({ kind: "network", detail: String(error) });
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return failed({ kind: "invalid", detail: String(error) });
  }
  const parsed = parseCatalog(json);
  if (!parsed.ok) {
    const error = parsed.error;
    if (error.kind === "unsupported-schema-version") {
      return failed({
        kind: "version",
        found: error.found,
        supported: error.supported,
      });
    }
    const issues = error.issues
      .slice(0, MAX_ISSUES)
      .map((issue) => `${issue.path}: ${issue.message}`);
    if (error.issues.length > MAX_ISSUES) {
      issues.push(`… ${String(error.issues.length - MAX_ISSUES)} more`);
    }
    return failed({
      kind: "invalid",
      detail: `${error.kind}\n${issues.join("\n")}`,
    });
  }
  return {
    status: "ready",
    catalog: parsed.value,
    index: buildPaintIndex(parsed.value),
  };
}

function failed(error: CatalogLoadError): CatalogLoad {
  return { status: "error", error };
}

/** The real adapter: `catalog.json` of the app, through the service worker. */
export const fetchCatalog: ReadCatalog = async () => {
  const response = await fetch("/catalog.json");
  if (!response.ok) {
    throw new Error(`HTTP ${String(response.status)}`);
  }
  return response.text();
};
