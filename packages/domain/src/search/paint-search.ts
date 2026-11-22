/**
 * Search of paints by what is written (docs/06 §9): their name, an alias,
 * their manufacturer code, their brand or their range. Without telling apart
 * capitals, accents or apostrophes, and by fragments.
 */
import type { Catalog } from "../catalog/catalog.ts";
import { compareSortKeys } from "../catalog/integrity.ts";
import type { Brand, Paint, Range } from "../catalog/schema.ts";

/**
 * The shortest query that searches, in characters, without the spaces around
 * it. With fewer, almost every paint matches.
 */
export const MIN_QUERY_LENGTH = 3;

/**
 * Whether `query` is long enough to search: at least
 * {@link MIN_QUERY_LENGTH} characters, as a person counts them, without the
 * spaces around it.
 */
export function isSearchable(query: string): boolean {
  const characters = new Intl.Segmenter().segment(query.trim());
  return Array.from(characters).length >= MIN_QUERY_LENGTH;
}

/** A stretch of a text, from `start` to `end` (not included), in code units. */
export interface TextRange {
  /** Where it starts. */
  readonly start: number;
  /** Where it ends, not included. */
  readonly end: number;
}

/**
 * Where what was written appears in each text a suggestion shows, to
 * highlight it. Sorted and without overlaps.
 */
export interface PaintSearchHighlights {
  /** In the paint's name. Matches in an alias are not highlighted, because the alias is not shown. */
  readonly name: readonly TextRange[];
  /** In its brand's name. */
  readonly brand: readonly TextRange[];
  /** In its range's name. */
  readonly range: readonly TextRange[];
  /** In its manufacturer code. */
  readonly code: readonly TextRange[];
}

/** A paint found by {@link searchPaints}. */
export interface PaintSearchHit {
  /** The paint, with or without colour. */
  readonly paint: Paint;
  /** Its brand. */
  readonly brand: Brand;
  /** Its range. */
  readonly range: Range;
  /**
   * Where what was written appears in each shown text, to highlight it: the
   * name of the paint, of its brand and of its range, and its code. Sorted
   * and without overlaps. Matches in an alias are not highlighted, because
   * the alias is not shown.
   */
  readonly highlights: PaintSearchHighlights;
}

/** A text without capitals, accents or apostrophes, and where each character came from. */
interface Folded {
  readonly text: string;
  /** For each character of `text`, its position in the original. */
  readonly origin: readonly number[];
}

interface SearchEntry {
  readonly paint: Paint;
  readonly brand: Brand;
  readonly range: Range;
  readonly name: Folded;
  readonly aliases: readonly string[];
  readonly brandName: Folded;
  readonly brandKeys: readonly string[];
  readonly rangeName: Folded;
  readonly code: Folded | null;
}

/**
 * The search index of a catalog, built by {@link buildPaintSearchIndex}. It
 * is opaque: only {@link searchPaints} reads it.
 */
export interface PaintSearchIndex {
  /** @internal */
  readonly entries: readonly SearchEntry[];
}

const APOSTROPHES = /['’‘`´]/u;
// In codes, the separators do not count either: `70950` finds `70.950`.
const CODE_SEPARATORS = /[\s.\-_/]/u;
const MARKS = /\p{M}/gu;

function fold(text: string, code = false): Folded {
  let folded = "";
  const origin: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index);
    if (APOSTROPHES.test(char) || (code && CODE_SEPARATORS.test(char))) {
      continue;
    }
    for (const part of char.normalize("NFD").replace(MARKS, "").toLowerCase()) {
      folded += part;
      origin.push(index);
    }
  }
  return { text: folded, origin };
}

const foldText = (text: string): string => fold(text).text;

/**
 * Builds the search index of a catalog: every paint, the discontinued ones
 * and those without colour included, because whoever has one can start from
 * it (docs/06 §9).
 * Build it once per catalog and reuse it in every search.
 */
export function buildPaintSearchIndex(catalog: Catalog): PaintSearchIndex {
  const entries = catalog
    .paints({ brandIds: "all", includeDiscontinued: true })
    .flatMap((paint): SearchEntry[] => {
      const range = catalog.range(paint.rangeId);
      if (range === undefined) return [];
      const brand = catalog.brandOf(paint);
      return [
        {
          paint,
          brand,
          range,
          name: fold(paint.name),
          aliases: paint.aliases.map(foldText),
          brandName: fold(brand.name),
          brandKeys: [brand.name, ...brand.aliases].map(foldText),
          rangeName: fold(range.name),
          code:
            paint.manufacturerCode === null
              ? null
              : fold(paint.manufacturerCode, true),
        },
      ];
    });
  return Object.freeze({ entries: Object.freeze(entries) });
}

/**
 * How well a paint matches, from 1 (best) to 5:
 *
 * 1. its name, an alias or its code is what was written;
 * 2. its name, an alias or its code starts with it;
 * 3. every word written starts a word of its name or of an alias;
 * 4. every word written is inside its name or an alias;
 * 5. some word is only in its brand, its range or its code.
 */
type Tier = 1 | 2 | 3 | 4 | 5;

/** Where `word` appears in `text`, overlapping ones included. */
function* occurrences(text: string, word: string): Generator<number> {
  for (
    let at = text.indexOf(word);
    at !== -1;
    at = text.indexOf(word, at + 1)
  ) {
    yield at;
  }
}

function startsAWord(text: string, word: string): boolean {
  for (const at of occurrences(text, word)) {
    if (at === 0 || !/[\p{L}\p{N}]/u.test(text.charAt(at - 1))) return true;
  }
  return false;
}

interface Query {
  readonly words: readonly string[];
  readonly codeWords: readonly string[];
  readonly whole: string;
  readonly wholeCode: string;
}

function tierOf(entry: SearchEntry, query: Query): Tier | undefined {
  const names = [entry.name.text, ...entry.aliases];
  const code = entry.code?.text ?? "";
  let allInName = true;
  let allStartWords = true;
  for (const [index, word] of query.words.entries()) {
    const codeWord = query.codeWords[index] ?? "";
    const inName = names.some((name) => name.includes(word));
    const elsewhere =
      (codeWord !== "" && code.includes(codeWord)) ||
      entry.brandKeys.some((key) => key.includes(word)) ||
      entry.rangeName.text.includes(word);
    if (!inName && !elsewhere) return undefined;
    if (!inName) allInName = false;
    if (!names.some((name) => startsAWord(name, word))) allStartWords = false;
  }
  const { whole, wholeCode } = query;
  if (names.includes(whole) || (code !== "" && code === wholeCode)) return 1;
  if (
    names.some((name) => name.startsWith(whole)) ||
    (code !== "" && wholeCode !== "" && code.startsWith(wholeCode))
  ) {
    return 2;
  }
  if (allStartWords) return 3;
  if (allInName) return 4;
  return 5;
}

function highlight(text: Folded, words: readonly string[]): TextRange[] {
  const found: TextRange[] = [];
  for (const word of words) {
    if (word === "") continue;
    for (const at of occurrences(text.text, word)) {
      const start = text.origin[at];
      const last = text.origin[at + word.length - 1];
      if (start !== undefined && last !== undefined) {
        found.push({ start, end: last + 1 });
      }
    }
  }
  found.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: TextRange[] = [];
  for (const range of found) {
    const previous = merged.at(-1);
    if (previous !== undefined && range.start <= previous.end) {
      merged[merged.length - 1] = {
        start: previous.start,
        end: Math.max(previous.end, range.end),
      };
    } else {
      merged.push(range);
    }
  }
  return merged;
}

// Within a tier: the active paints first, then by name, brand, range and ID,
// by code unit and without locale, as docs/02 sorts.
const sortKey = ({ name, brandName, rangeName, paint }: SearchEntry) => [
  paint.status.kind === "active" ? "0" : "1",
  name.text,
  brandName.text,
  rangeName.text,
  paint.id,
];

/**
 * Searches the paints whose name, alias, code, brand or range contain every
 * word written, without telling apart capitals, accents or apostrophes, and by
 * fragments: `tigers skin` finds «Tiger's Eye Skin», `vallejo black` the
 * Black of Vallejo, and `70950` the paint with code `70.950`.
 *
 * The order (docs/06 §9.2): first the paints whose name or code is what was
 * written, then those that start with it, those where every word starts a
 * word of the name, those where every word is inside the name, and last those
 * found only by brand, range or code. Within each group, the active paints
 * before the discontinued ones, then by name, brand, range and ID. The
 * result is frozen.
 *
 * @param index - The index of the catalog, from {@link buildPaintSearchIndex}.
 * @param query - What was written.
 * @returns Every paint found, in order. Empty if `query` is not
 *   {@link isSearchable}.
 *
 * @example
 * ```ts
 * const index = buildPaintSearchIndex(catalog);
 * const [first] = searchPaints(index, "lothern");
 * console.log(first?.paint.name); // "Lothern Blue"
 * ```
 */
export function searchPaints(
  index: PaintSearchIndex,
  query: string,
): readonly PaintSearchHit[] {
  if (!isSearchable(query)) return Object.freeze([]);
  const trimmed = query.trim();
  const raw = trimmed.split(/\s+/u);
  const pairs = raw
    .map((word) => ({ word: foldText(word), code: fold(word, true).text }))
    .filter(({ word }) => word !== "");
  if (pairs.length === 0) return Object.freeze([]);
  const parsed: Query = {
    words: pairs.map(({ word }) => word),
    codeWords: pairs.map(({ code }) => code),
    whole: pairs.map(({ word }) => word).join(" "),
    wholeCode: fold(trimmed, true).text,
  };

  const found = index.entries.flatMap((entry) => {
    const tier = tierOf(entry, parsed);
    return tier === undefined ? [] : [{ entry, tier }];
  });
  found.sort(
    (a, b) =>
      a.tier - b.tier || compareSortKeys(sortKey(a.entry), sortKey(b.entry)),
  );
  return Object.freeze(
    found.map(({ entry }) =>
      Object.freeze({
        paint: entry.paint,
        brand: entry.brand,
        range: entry.range,
        highlights: Object.freeze({
          name: highlight(entry.name, parsed.words),
          brand: highlight(entry.brandName, parsed.words),
          range: highlight(entry.rangeName, parsed.words),
          code:
            entry.code === null ? [] : highlight(entry.code, parsed.codeWords),
        }),
      }),
    ),
  );
}
