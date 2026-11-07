/**
 * Structural schema of `catalog.json` (docs/02 §3). Entity types are inferred
 * from it (ADR-0002). Cross-field and referential rules live in `integrity.ts`.
 */
import { z } from "zod";

export const SUPPORTED_SCHEMA_VERSION = 1;

// ── Identifiers (docs/03 §1) ─────────────────────────────────

const SLUG = "[a-z0-9]+(?:-[a-z0-9]+)*";
const slugPattern = new RegExp(`^${SLUG}$`);
const rangeIdPattern = new RegExp(`^${SLUG}/${SLUG}$`);
const paintIdPattern = new RegExp(`^${SLUG}(?:/${SLUG}){2}$`);

export const brandIdSchema = z.string().regex(slugPattern).brand<"BrandId">();
export const rangeIdSchema = z
  .string()
  .regex(rangeIdPattern)
  .brand<"RangeId">();
export const paintIdSchema = z
  .string()
  .regex(paintIdPattern)
  .brand<"PaintId">();
export const sourceIdSchema = z.string().regex(slugPattern).brand<"SourceId">();
export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/)
  .brand<"HexColor">();
export const isoDateSchema = z.iso.date().brand<"IsoDate">();

export type BrandId = z.infer<typeof brandIdSchema>;
export type RangeId = z.infer<typeof rangeIdSchema>;
export type PaintId = z.infer<typeof paintIdSchema>;
export type SourceId = z.infer<typeof sourceIdSchema>;
export type HexColor = z.infer<typeof hexColorSchema>;
export type IsoDate = z.infer<typeof isoDateSchema>;

// ── Shared ───────────────────────────────────────────────────

const nonEmptyString = z.string().min(1);
const aliasesSchema = z.array(nonEmptyString).readonly();

// ── Source ───────────────────────────────────────────────────

// The literal prefix check comes first: `new URL()` (behind `z.url()`) also
// accepts malformed forms such as `https:example.com` and normalises them.
const httpUrlSchema = z
  .string()
  .regex(/^https?:\/\/[^/]/)
  .pipe(z.url());
const archiveUrlSchema = z
  .string()
  .startsWith("https://web.archive.org/")
  .pipe(z.url());

export const sourceKindSchema = z.enum(["manufacturer", "third-party"]);

export const sourceSchema = z
  .object({
    id: sourceIdSchema,
    kind: sourceKindSchema,
    title: nonEmptyString,
    publisher: nonEmptyString,
    url: httpUrlSchema.nullable(),
    archiveUrl: archiveUrlSchema.nullable(),
    retrievedAt: isoDateSchema,
    license: nonEmptyString,
    attribution: nonEmptyString.nullable(),
  })
  .readonly();

export type SourceKind = z.infer<typeof sourceKindSchema>;
export type Source = z.infer<typeof sourceSchema>;

// ── Brand and range ──────────────────────────────────────────

export const brandSchema = z
  .object({
    id: brandIdSchema,
    name: nonEmptyString,
    aliases: aliasesSchema,
  })
  .readonly();

export const rangeStatusSchema = z.enum(["active", "discontinued"]);

export const rangeSchema = z
  .object({
    id: rangeIdSchema,
    brandId: brandIdSchema,
    name: nonEmptyString,
    status: rangeStatusSchema,
  })
  .readonly();

export type Brand = z.infer<typeof brandSchema>;
export type RangeStatus = z.infer<typeof rangeStatusSchema>;
export type Range = z.infer<typeof rangeSchema>;

// ── Paint ────────────────────────────────────────────────────

export const paintTypeSchema = z.enum([
  "base",
  "layer",
  "standard",
  "wash",
  "ink",
  "glaze",
  "contrast",
  "technical",
  "dry",
]);

export const colorOriginSchema = z.enum([
  "manufacturer",
  "measured",
  "community",
]);

export const paintColorSchema = z
  .object({
    hex: hexColorSchema,
    origin: colorOriginSchema,
    sourceId: sourceIdSchema,
  })
  .readonly();

export const replacementSchema = z
  .object({
    paintId: paintIdSchema,
    sourceId: sourceIdSchema,
  })
  .readonly();

export const paintStatusSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("active") }),
    z.object({
      kind: z.literal("discontinued"),
      replacement: replacementSchema.nullable(),
    }),
  ])
  .readonly();

export const paintSchema = z
  .object({
    id: paintIdSchema,
    rangeId: rangeIdSchema,
    name: nonEmptyString,
    aliases: aliasesSchema,
    manufacturerCode: nonEmptyString.nullable(),
    type: paintTypeSchema,
    metallic: z.boolean(),
    color: paintColorSchema.nullable(),
    status: paintStatusSchema,
  })
  .readonly();

export type PaintType = z.infer<typeof paintTypeSchema>;
export type ColorOrigin = z.infer<typeof colorOriginSchema>;
export type PaintColor = z.infer<typeof paintColorSchema>;
export type Replacement = z.infer<typeof replacementSchema>;
export type PaintStatus = z.infer<typeof paintStatusSchema>;
export type Paint = z.infer<typeof paintSchema>;

// ── Official equivalence ─────────────────────────────────────

export const officialEquivalenceSchema = z
  .object({
    from: paintIdSchema,
    to: paintIdSchema,
    sourceId: sourceIdSchema,
  })
  .readonly();

export type OfficialEquivalence = z.infer<typeof officialEquivalenceSchema>;

// ── Document ─────────────────────────────────────────────────

export const catalogMetaSchema = z
  .object({
    schemaVersion: z.int().min(1),
    dataVersion: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  })
  .readonly();

/** Shape of `catalog.json`. Key order matches docs/02 and the builder output. */
export const catalogDocumentSchema = z
  .object({
    meta: catalogMetaSchema,
    sources: z.array(sourceSchema).readonly(),
    brands: z.array(brandSchema).readonly(),
    ranges: z.array(rangeSchema).readonly(),
    paints: z.array(paintSchema).readonly(),
    equivalences: z.array(officialEquivalenceSchema).readonly(),
  })
  .readonly();

export type CatalogMeta = z.infer<typeof catalogMetaSchema>;
export type CatalogDocument = z.infer<typeof catalogDocumentSchema>;
