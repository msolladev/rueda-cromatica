/**
 * Structural schema of `catalog.json` (docs/02 §3). Entity types are inferred
 * from it (ADR-0002). Cross-field and referential rules live in `integrity.ts`.
 */
import { z } from "zod";

/**
 * The version of the `catalog.json` format that this package reads.
 * {@link parseCatalog} rejects a catalog with another version.
 */
export const SUPPORTED_SCHEMA_VERSION = 1;

// ── Identifiers (docs/03 §1) ─────────────────────────────────

const SLUG = "[a-z0-9]+(?:-[a-z0-9]+)*";
const slugPattern = new RegExp(`^${SLUG}$`);
const rangeIdPattern = new RegExp(`^${SLUG}/${SLUG}$`);
const paintIdPattern = new RegExp(`^${SLUG}(?:/${SLUG}){2}$`);

/** Validates a {@link BrandId}. */
export const brandIdSchema = z.string().regex(slugPattern).brand<"BrandId">();
/** Validates a {@link RangeId}. */
export const rangeIdSchema = z
  .string()
  .regex(rangeIdPattern)
  .brand<"RangeId">();
/** Validates a {@link PaintId}. */
export const paintIdSchema = z
  .string()
  .regex(paintIdPattern)
  .brand<"PaintId">();
/** Validates a {@link SourceId}. */
export const sourceIdSchema = z.string().regex(slugPattern).brand<"SourceId">();
/** Validates a {@link HexColor}. */
export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/)
  .brand<"HexColor">();
/** Validates an {@link IsoDate}. */
export const isoDateSchema = z.iso.date().brand<"IsoDate">();

/**
 * Brand ID: a slug of lowercase letters, digits and single hyphens, such as
 * `citadel`. IDs are generated once and never recalculated; code compares
 * them whole and never splits them (docs/03).
 *
 * @useDeclaredType
 */
export type BrandId = z.infer<typeof brandIdSchema>;
/**
 * Range ID: the brand's slug and the range's, such as `citadel/base`.
 *
 * @useDeclaredType
 */
export type RangeId = z.infer<typeof rangeIdSchema>;
/**
 * Paint ID: the range's ID and the paint's slug, such as
 * `citadel/base/abaddon-black`.
 *
 * @useDeclaredType
 */
export type PaintId = z.infer<typeof paintIdSchema>;
/**
 * Source ID: a slug, such as `simogecko-citadel-colours`.
 *
 * @useDeclaredType
 */
export type SourceId = z.infer<typeof sourceIdSchema>;
/**
 * An sRGB color as `#rrggbb`, in lowercase.
 *
 * @useDeclaredType
 */
export type HexColor = z.infer<typeof hexColorSchema>;
/**
 * A valid calendar date as `YYYY-MM-DD`.
 *
 * @useDeclaredType
 */
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

/** Validates a {@link SourceKind}. */
export const sourceKindSchema = z.enum(["manufacturer", "third-party"]);

/** Validates a {@link Source}. */
export const sourceSchema = z
  .object({
    /** Unique ID, which never changes. */
    id: sourceIdSchema,
    /** Who authored the content. */
    kind: sourceKindSchema,
    /** Title of the document or page. Not empty. */
    title: nonEmptyString,
    /** Who publishes the document or page, by name. Not empty. */
    publisher: nonEmptyString,
    /** Official URL, `http` or `https`. `null` for printed sources. */
    url: httpUrlSchema.nullable(),
    /**
     * Capture in the Wayback Machine (`https://web.archive.org/…`). `null` if
     * there is none, and always `null` when `url` is.
     */
    archiveUrl: archiveUrlSchema.nullable(),
    /** When it was consulted. */
    retrievedAt: isoDateSchema,
    /** SPDX identifier, `"terms-of-use"` or `"unknown"`. Not empty. */
    license: nonEmptyString,
    /** Attribution text that the license requires, or `null`. Not empty. */
    attribution: nonEmptyString.nullable(),
  })
  .readonly();

/**
 * Who authored a source's content: `"manufacturer"`, the brand itself, or
 * `"third-party"`, anyone else. A faithful copy of a manufacturer document
 * hosted by a third party is still `"manufacturer"`. Official equivalences
 * and replacements need a manufacturer source.
 *
 * @useDeclaredType
 */
export type SourceKind = z.infer<typeof sourceKindSchema>;
/**
 * Where a piece of data comes from: a document or page, with what is needed
 * to trace it and respect its license.
 *
 * @interface
 */
export type Source = z.infer<typeof sourceSchema>;

// ── Brand and range ──────────────────────────────────────────

/** Validates a {@link Brand}. */
export const brandSchema = z
  .object({
    /** Unique ID, which never changes. */
    id: brandIdSchema,
    /** Current name. Not empty. */
    name: nonEmptyString,
    /**
     * Earlier or alternative names, for the search. Not empty, without
     * duplicates and without repeating `name`.
     */
    aliases: aliasesSchema,
  })
  .readonly();

/** Validates a {@link RangeStatus}. */
export const rangeStatusSchema = z.enum(["active", "discontinued"]);

/** Validates a {@link Range}. */
export const rangeSchema = z
  .object({
    /** Unique ID, which never changes. */
    id: rangeIdSchema,
    /** The brand it belongs to. */
    brandId: brandIdSchema,
    /** Name. Not empty. */
    name: nonEmptyString,
    /** Whether it is still sold. */
    status: rangeStatusSchema,
  })
  .readonly();

/**
 * A paint manufacturer, such as Citadel.
 *
 * @interface
 */
export type Brand = z.infer<typeof brandSchema>;
/**
 * Whether a range is still sold. In a `"discontinued"` range, every paint is
 * discontinued.
 *
 * @useDeclaredType
 */
export type RangeStatus = z.infer<typeof rangeStatusSchema>;
/**
 * A line of paints of a brand, such as Citadel Base.
 *
 * @interface
 */
export type Range = z.infer<typeof rangeSchema>;

// ── Paint ────────────────────────────────────────────────────

/** Validates a {@link PaintType}. */
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

/** Validates a {@link ColorOrigin}. */
export const colorOriginSchema = z.enum([
  "manufacturer",
  "measured",
  "community",
]);

/** Validates a {@link PaintColor}. */
export const paintColorSchema = z
  .object({
    /** The color, in sRGB. */
    hex: hexColorSchema,
    /** How the hex was obtained. */
    origin: colorOriginSchema,
    /** Where the hex comes from. */
    sourceId: sourceIdSchema,
  })
  .readonly();

/** Validates a {@link Replacement}. */
export const replacementSchema = z
  .object({
    /** The paint that replaces it. Never the paint itself. */
    paintId: paintIdSchema,
    /** The manufacturer source that says so. */
    sourceId: sourceIdSchema,
  })
  .readonly();

/** Validates a {@link PaintStatus}. */
export const paintStatusSchema = z
  .discriminatedUnion("kind", [
    z.object({
      /** Still sold. */
      kind: z.literal("active"),
    }),
    z.object({
      /** No longer sold. */
      kind: z.literal("discontinued"),
      /** Its replacement, or `null` if no manufacturer source names one. */
      replacement: replacementSchema.nullable(),
    }),
  ])
  .readonly();

/** Validates a {@link Paint}. */
export const paintSchema = z
  .object({
    /** Unique ID, which never changes. */
    id: paintIdSchema,
    /** The range it belongs to. */
    rangeId: rangeIdSchema,
    /** Current name. Not empty. */
    name: nonEmptyString,
    /**
     * Earlier or alternative names, for the search. Not empty, without
     * duplicates and without repeating `name`.
     */
    aliases: aliasesSchema,
    /**
     * The manufacturer's code, only if a source gives it. It is an attribute,
     * not the paint's identity. Not empty.
     */
    manufacturerCode: nonEmptyString.nullable(),
    /** What the paint is for. */
    type: paintTypeSchema,
    /** Whether it is metallic, independently of its type. */
    metallic: z.boolean(),
    /**
     * Its only color, or `null` if no source gives one. A paint without color
     * is in the catalog, but not in the wheel or the calculated equivalences.
     */
    color: paintColorSchema.nullable(),
    /** Whether it is still sold and, if not, its replacement. */
    status: paintStatusSchema,
  })
  .readonly();

/**
 * What a paint is for, from the manufacturer's classification (ADR-0013):
 * `"base"`, `"layer"`, `"standard"` (opaque, from a brand that does not
 * distinguish base and layer), `"wash"`, `"ink"`, `"glaze"`, `"contrast"`
 * (pigment and shading in a single coat, of any brand, such as Xpress Color,
 * Speedpaint 2.0 or Quick Gen), `"technical"` or `"dry"` (drybrush).
 *
 * @useDeclaredType
 */
export type PaintType = z.infer<typeof paintTypeSchema>;
/**
 * How a hex was obtained:
 *
 * - `"measured"`: with an instrument, on a painted sample;
 * - `"manufacturer"`: published by the manufacturer;
 * - `"community"`: any other, including hexes taken from photos.
 *
 * @useDeclaredType
 */
export type ColorOrigin = z.infer<typeof colorOriginSchema>;
/**
 * The color of a paint, with its origin and its source.
 *
 * @interface
 */
export type PaintColor = z.infer<typeof paintColorSchema>;
/**
 * The paint that replaces a discontinued one, according to a manufacturer
 * source that says so expressly. Conversion charts are official
 * equivalences, not replacements.
 *
 * @interface
 */
export type Replacement = z.infer<typeof replacementSchema>;
/**
 * Whether a paint is still sold. Only a discontinued paint can have a
 * replacement.
 *
 * @useDeclaredType
 */
export type PaintStatus = z.infer<typeof paintStatusSchema>;
/**
 * A paint of a range.
 *
 * @interface
 */
export type Paint = z.infer<typeof paintSchema>;

// ── Official equivalence ─────────────────────────────────────

/** Validates an {@link OfficialEquivalence}. */
export const officialEquivalenceSchema = z
  .object({
    /** The original paint. */
    from: paintIdSchema,
    /** Its equivalent. Never the same as `from`. */
    to: paintIdSchema,
    /** The manufacturer source that publishes it. */
    sourceId: sourceIdSchema,
  })
  .readonly();

/**
 * An equivalence published by a manufacturer, from one paint to another
 * (ADR-0004). It is read only in its direction: neither the inverse nor the
 * transitive ones are inferred.
 *
 * @interface
 */
export type OfficialEquivalence = z.infer<typeof officialEquivalenceSchema>;

// ── Document ─────────────────────────────────────────────────

/** Validates a {@link CatalogMeta}. */
export const catalogMetaSchema = z
  .object({
    /** Version of the format, an integer from 1. */
    schemaVersion: z.int().min(1),
    /**
     * Version of the data: `sha256:` and the 64 hexadecimal digits of the
     * hash of the content. It changes only when the data change.
     */
    dataVersion: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  })
  .readonly();

/**
 * Validates the structure of `catalog.json` (docs/02). The rules between
 * fields and between entities are checked by {@link parseCatalog}. Key order
 * matches docs/02 and the builder output.
 */
export const catalogDocumentSchema = z
  .object({
    /** Versions of the format and of the data. */
    meta: catalogMetaSchema,
    /** Every source. */
    sources: z.array(sourceSchema).readonly(),
    /** Every brand. */
    brands: z.array(brandSchema).readonly(),
    /** Every range. */
    ranges: z.array(rangeSchema).readonly(),
    /** Every paint. */
    paints: z.array(paintSchema).readonly(),
    /** Every official equivalence. */
    equivalences: z.array(officialEquivalenceSchema).readonly(),
  })
  .readonly();

/**
 * Versions of the format and of the data of a catalog.
 *
 * @interface
 */
export type CatalogMeta = z.infer<typeof catalogMetaSchema>;
/**
 * The content of `catalog.json`, already validated. The rest of the code
 * reads it through {@link Catalog}.
 *
 * @interface
 */
export type CatalogDocument = z.infer<typeof catalogDocumentSchema>;
