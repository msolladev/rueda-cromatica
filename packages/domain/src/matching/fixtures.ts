/**
 * The real `catalog.json` for matching tests, so they use real paints and real
 * hex values. Each test gets its own copy of the document to edit.
 */
import catalogJson from "../../../../apps/web/public/catalog.json" with { type: "json" };
import type { Catalog } from "../catalog/catalog.ts";
import { catalogOf, type Draft } from "../catalog/fixtures.ts";
import { buildPaintIndex, type PaintIndex } from "./paint-index.ts";

// A JSON round trip: `domain` has no DOM or Node types, so no `structuredClone`.
export const realDraft = (): Draft =>
  JSON.parse(JSON.stringify(catalogJson)) as Draft;

export const realCatalog = (): Catalog => catalogOf(realDraft());

export const indexOf = (draft: Draft): PaintIndex =>
  buildPaintIndex(catalogOf(draft));
