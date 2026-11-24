/**
 * Importer of the equivalence table of AK Interactive (`EQUIVALENCIAS2023`,
 * ADR-0033): seven pages with one row per 3rd Generation acrylic, by its
 * reference, and its equivalents in Vallejo Model Color, Vallejo Game Color,
 * the current Citadel range and the old one. The cells are centred in their
 * columns. Pure: it receives the text of the PDF already read.
 */
import { err, type Result } from "@chromatic-wheel/domain";
import { chartCollector, type Transcription } from "./chart.ts";
import {
  CITADEL_BY_NAME,
  prefixedCode,
  sameCode,
  type KeyRules,
} from "./chart-keys.ts";
import {
  cellText,
  near,
  textItems,
  type PdfText,
  type PdfTextItem,
} from "./pdf-text.ts";

/** The table; the titles, the logo and the footer use other sizes. */
const TABLE_SIZE = 5;

/** The columns, by their header, in order. */
const COLUMNS = [
  { header: "Ref.", kind: "reference", group: "AK 3G" },
  { header: "Color", kind: "swatch", group: "" },
  { header: "Vallejo MC", kind: "code", group: "Vallejo MC" },
  { header: "Vallejo GC", kind: "code", group: "Vallejo GC" },
  { header: "New Citadel", kind: "name", group: "New Citadel" },
  { header: "Old Citadel", kind: "name", group: "Old Citadel" },
] as const;

const REFERENCE = /^AK\d{5}$/;

/**
 * Words of a header repeated at the foot of a page (page 4), which writes
 * «Vallejo» for «Vallejo MC».
 */
const FOOTER_WORDS = new Set<string>([
  ...COLUMNS.map((c) => c.header),
  "Vallejo",
]);

/**
 * Transcribes every row. Each AK paint is a row keyed by its reference
 * (`AK11029`), without a name because the table gives none; each equivalent
 * is a row keyed by its column and its cell (`Vallejo GC/051`,
 * `New Citadel/Abaddon Black`) and an equivalence from the AK paint. A cell
 * with two codes, such as «049/047», is two equivalences, with a note.
 */
export function transcribeAk3GenEquivalences(
  pdf: PdfText,
): Result<Transcription, readonly string[]> {
  if (pdf.length === 0) return err(["The PDF has no pages"]);
  const chart = chartCollector();
  pdf.forEach((page, p) => {
    const where = (item: PdfTextItem): string =>
      `page ${String(p + 1)}, "${item.text}" at (${String(item.x)}, ${String(item.y)})`;
    const items = textItems(page).filter((i) => i.size === TABLE_SIZE);
    const centre = (item: PdfTextItem): number => item.x + item.width / 2;

    // The header: the first row that starts with «Ref.». Another one lower
    // down is the same header repeated at the foot.
    const [first, ...repeated] = items
      .filter((i) => i.text.trim() === COLUMNS[0].header)
      .sort((a, b) => a.y - b.y);
    if (first === undefined) {
      chart.issue(`page ${String(p + 1)}: no header row`);
      return;
    }
    const footers = items.filter((i) =>
      repeated.some((r) => near(r.y, i.y, 1)),
    );
    for (const item of footers) {
      if (!FOOTER_WORDS.has(item.text.trim())) {
        chart.issue(`${where(item)} is in a repeated header`);
      }
    }
    const titles = items.filter((i) => near(i.y, first.y, 1));
    const columns = COLUMNS.map((column) =>
      titles.find((t) => t.text.trim() === column.header),
    );
    if (columns.some((c) => c === undefined) || titles.length !== 6) {
      chart.issue(
        `page ${String(p + 1)}: headers "${titles.map((t) => t.text).join(" | ")}" are not the expected ones`,
      );
      return;
    }
    const centres = columns.map((c) => (c === undefined ? NaN : centre(c)));

    const body = items.filter(
      (i) => !titles.includes(i) && !footers.includes(i),
    );
    const rows = body.filter((i) => REFERENCE.test(i.text.trim()));
    const cells = new Map<PdfTextItem, string[]>(
      rows.map((row) => [row, COLUMNS.map(() => "")]),
    );
    for (const item of body) {
      if (rows.includes(item)) continue;
      const row = rows.find((r) => near(r.y, item.y, 1));
      let column = 0;
      centres.forEach((c, i) => {
        if (
          Math.abs(c - centre(item)) <
          Math.abs((centres[column] ?? NaN) - centre(item))
        ) {
          column = i;
        }
      });
      const line = row === undefined ? undefined : cells.get(row);
      if (line === undefined || column === 0 || (line[column] ?? "") !== "") {
        chart.issue(`${where(item)} is in no free cell`);
        continue;
      }
      line[column] = cellText([item]);
    }

    for (const row of [...rows].sort((a, b) => a.y - b.y)) {
      const reference = row.text.trim();
      const ak = chart.paint({
        key: reference,
        group: COLUMNS[0].group,
        name: "",
        code: reference,
      });
      COLUMNS.forEach((column, i) => {
        const value = cells.get(row)?.[i] ?? "";
        if (column.kind === "reference" || column.kind === "swatch") {
          if (column.kind === "swatch" && value !== "") {
            chart.issue(`${reference}: text "${value}" in the colour column`);
          }
          return;
        }
        if (value === "") return;
        const parts = column.kind === "code" ? value.split("/") : [value];
        const note = parts.length > 1 ? `Casilla «${value}».` : undefined;
        for (const part of parts) {
          const key = chart.paint({
            key: `${column.group}/${part}`,
            group: column.group,
            name: column.kind === "name" ? part : "",
            code: column.kind === "code" ? part : null,
          });
          chart.equivalence(ak, key, note);
        }
      });
    }
  });
  return chart.result();
}

/** How the rows of each column of the table find their curated paint. */
export const AK_3GEN_KEYS: KeyRules = {
  "AK 3G": {
    brandId: "ak-interactive",
    rangeIds: ["ak-interactive/3gen-acrylics"],
    by: "code",
    code: sameCode,
  },
  "Vallejo MC": {
    brandId: "vallejo",
    rangeIds: ["vallejo/model-color"],
    by: "code",
    code: prefixedCode("70"),
  },
  "Vallejo GC": {
    brandId: "vallejo",
    rangeIds: ["vallejo/game-color"],
    by: "code",
    code: prefixedCode("72"),
  },
  "New Citadel": CITADEL_BY_NAME,
};
