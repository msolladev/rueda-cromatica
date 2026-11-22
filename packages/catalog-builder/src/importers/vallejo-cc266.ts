/**
 * Importer of the Game Color chart of Vallejo, CC266 (ADR-0033). Its
 * equivalences are in the last panel of the first page, in three tables:
 * Game Color, with Game Air, Hobby Paint and Citadel; Game Color Wash, with
 * Citadel; and Xpress Color, with Citadel. Each table is printed in two
 * columns side by side. Pure: it receives the text of the PDF already read.
 */
import { err, type Result } from "@chromatic-wheel/domain";
import { chartCollector, type Transcription } from "./chart.ts";
import {
  cellText,
  near,
  textItems,
  type PdfText,
  type PdfTextItem,
} from "./pdf-text.ts";

const HEADER_SIZE = 6;
const CELL_SIZE = 5;
/** The title of the panel; its legal notice is set smaller (4.75). */
const TITLE = "Game Color equivalences";

const CODE = /^\d{2}\.\d{3}$/;

/** A column: the words of its header and the group of its rows. */
interface Column {
  readonly header: string;
  /** `code` columns name a paint with the `name` column after them. */
  readonly kind: "code" | "name" | "citadel";
  readonly group: string;
}

/**
 * The tables, by the label of their first column, with their columns in
 * order. The headers are checked word for word, so a new layout fails
 * instead of being read wrong.
 */
const TABLES: Readonly<Record<string, readonly Column[]>> = {
  GC: [
    { header: "GC ref.", kind: "code", group: "Game Color" },
    { header: "Game Color descrip.", kind: "name", group: "Game Color" },
    { header: "GA ref.", kind: "code", group: "Game Air" },
    { header: "Game Air descrip.", kind: "name", group: "Game Air" },
    { header: "HP ref.", kind: "code", group: "Hobby Paint" },
    { header: "Hobby Paint descrip.", kind: "name", group: "Hobby Paint" },
    { header: "Citadel", kind: "citadel", group: "Citadel" },
  ],
  "GC-W": [
    { header: "Ref. GC-W", kind: "code", group: "Game Color Wash" },
    { header: "Game Color Wash", kind: "name", group: "Game Color Wash" },
    { header: "Citadel", kind: "citadel", group: "Citadel" },
  ],
  XC: [
    { header: "Ref. XC", kind: "code", group: "Xpress Color" },
    { header: "Xpress Color", kind: "name", group: "Xpress Color" },
    { header: "Citadel", kind: "citadel", group: "Citadel" },
  ],
};

/** The prefix of the key of a paint without a code. */
const CITADEL = "Citadel";

/** A table found on the page: where it is and its columns. */
interface Table {
  readonly label: string;
  readonly columns: readonly (Column & { readonly x: number })[];
  readonly left: number;
  readonly right: number;
  readonly top: number;
  /** Where the next table below starts, or `Infinity`. */
  readonly bottom: number;
}

/**
 * Transcribes the three tables. Each Vallejo paint is a row keyed by its
 * code (`72.051`), each Citadel paint by its name (`Citadel/Abbadon Black`),
 * and each paint of a row is an equivalence from the Vallejo paint of its
 * first column. A cell of two lines, such as «Baneblade Brown (Layer)», is
 * one name.
 */
export function transcribeCc266(
  pdf: PdfText,
): Result<Transcription, readonly string[]> {
  const page = pdf[0];
  if (page === undefined) return err(["The PDF has no pages"]);
  const panel = textItems(page).filter((i) => i.x >= (page.width * 5) / 6);
  if (!panel.some((i) => i.text.trim() === TITLE)) {
    return err([`No "${TITLE}" in the last panel of the first page`]);
  }
  const headers = panel.filter((i) => i.size === HEADER_SIZE);
  const cells = panel.filter((i) => i.size === CELL_SIZE);

  const tables = findTables(headers);
  if (!tables.ok) return tables;
  const chart = chartCollector();
  const used = new Set<PdfTextItem>();
  for (const table of tables.value) {
    readTable(table, cells, chart, used);
  }
  for (const item of cells) {
    if (!used.has(item)) {
      chart.issue(
        `"${item.text}" at (${String(item.x)}, ${String(item.y)}) is in no table`,
      );
    }
  }
  return chart.result();
}

/** The tables, in reading order: top to bottom, then left to right. */
function findTables(
  headers: readonly PdfTextItem[],
): Result<readonly Table[], readonly string[]> {
  const anchors = headers
    .filter((item) => item.text.trim() in TABLES)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const issues: string[] = [];
  const found = anchors.map((anchor) => {
    const label = anchor.text.trim();
    const right = Math.min(
      ...anchors
        .filter((a) => near(a.y, anchor.y, 1) && a.x > anchor.x)
        .map((a) => a.x),
    );
    // The header block: the words within a few points of the label.
    const words = headers.filter(
      (h) => h.x >= anchor.x - 1 && h.x < right - 1 && near(h.y, anchor.y, 7),
    );
    const xs = [...new Set(words.map((w) => w.x))].sort((a, b) => a - b);
    const columns = xs.map((x) =>
      cellText(words.filter((w) => w.x === x).sort((a, b) => a.y - b.y)),
    );
    const expected = TABLES[label] ?? [];
    if (columns.join(" | ") !== expected.map((c) => c.header).join(" | ")) {
      issues.push(
        `Table ${label} at (${String(anchor.x)}, ${String(anchor.y)}): headers "${columns.join(" | ")}" are not the expected ones`,
      );
    }
    return {
      label,
      columns: expected.map((column, i) => ({ ...column, x: xs[i] ?? NaN })),
      left: anchor.x - 1,
      right: right - 1,
      top: Math.max(...words.map((w) => w.y)),
    };
  });
  if (issues.length > 0) return { ok: false, error: issues };
  return {
    ok: true,
    value: found.map((table) => ({
      ...table,
      // The next table below that shares part of its width.
      bottom: Math.min(
        ...found
          .filter(
            (other) =>
              other.top > table.top + 1 &&
              other.left < table.right &&
              other.right > table.left,
          )
          .map((other) => other.top - 10),
      ),
    })),
  };
}

function readTable(
  table: Table,
  cells: readonly PdfTextItem[],
  chart: ReturnType<typeof chartCollector>,
  used: Set<PdfTextItem>,
): void {
  const inside = cells.filter(
    (item) =>
      item.x >= table.left &&
      item.x < table.right &&
      item.y > table.top &&
      item.y < table.bottom,
  );
  const [first] = table.columns;
  if (first === undefined) return;
  const rows = inside
    .filter((item) => near(item.x, first.x, 1))
    .sort((a, b) => a.y - b.y);

  // Each cell goes to its column and to the nearest row.
  const grid = new Map<PdfTextItem, PdfTextItem[][]>(
    rows.map((row) => [row, table.columns.map(() => [])]),
  );
  for (const item of inside) {
    const column = table.columns.findIndex((c) => near(item.x, c.x, 1));
    const row = nearest(rows, item.y);
    if (column < 0 || row === undefined || !near(row.y, item.y, 8)) {
      chart.issue(
        `Table ${table.label}: "${item.text}" at (${String(item.x)}, ${String(item.y)}) is in no cell`,
      );
      continue;
    }
    grid.get(row)?.[column]?.push(item);
    used.add(item);
  }

  for (const [row, columns] of grid) {
    const text = columns.map((items) =>
      cellText([...items].sort((a, b) => a.y - b.y)),
    );
    const paints: string[] = [];
    table.columns.forEach((column, i) => {
      const value = text[i] ?? "";
      if (column.kind === "name") return;
      if (column.kind === "citadel") {
        if (value !== "") {
          paints.push(
            chart.paint({
              key: `${CITADEL}/${value}`,
              group: column.group,
              name: value,
              code: null,
            }),
          );
        }
        return;
      }
      const name = text[i + 1] ?? "";
      if (value === "" && name === "") return;
      if (!CODE.test(value)) {
        chart.issue(
          `Table ${table.label}, row at ${String(row.y)}: "${value}" is not a code (${column.header})`,
        );
        return;
      }
      paints.push(
        chart.paint({ key: value, group: column.group, name, code: value }),
      );
    });
    const [vallejo, ...others] = paints;
    if (vallejo === undefined) continue;
    for (const other of others) chart.equivalence(vallejo, other);
  }
}

function nearest(
  rows: readonly PdfTextItem[],
  y: number,
): PdfTextItem | undefined {
  let best: PdfTextItem | undefined;
  for (const row of rows) {
    if (best === undefined || Math.abs(row.y - y) < Math.abs(best.y - y)) {
      best = row;
    }
  }
  return best;
}
