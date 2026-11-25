/**
 * Importer of the Warpaints Fanatic Conversion Chart of The Army Painter
 * (ADR-0033): one A3 page of hexagons, one per Fanatic colour, each with up to
 * three suggestions in fixed slots, marked with an icon: the original
 * Warpaints (WP), Warpaints Air (AIR) and Citadel (GW). The icons are
 * pictures, so the slot of a suggestion is known only by its height under the
 * name of the colour. Pure: it receives the text of the PDF already read.
 */
import { err, type Result } from "@chromatic-wheel/domain";
import { chartCollector, type Transcription } from "./chart.ts";
import { CITADEL_BY_NAME, type KeyRules } from "./chart-keys.ts";
import { near, textItems, type PdfText, type PdfTextItem } from "./pdf-text.ts";

/** The name of each Fanatic colour, in its hexagon. */
const NAME_SIZE = 6;
/** The suggestions, under the name. */
const SLOT_SIZE = 5;

/**
 * The slots, by their distance under the name, in points: the label of the
 * chart's legend, the prefix of the key and the group of the row.
 */
const SLOTS = [
  { offset: 7.4, label: "WP", group: "Original Warpaints" },
  { offset: 14.6, label: "AIR", group: "Warpaints Air" },
  { offset: 21.8, label: "GW", group: "Citadel by Games Workshop" },
] as const;

const FANATIC = { label: "Fanatic", group: "Warpaints Fanatic" } as const;

/** Text of the name size that is not a colour: the version and the notice. */
const FOOTER = /^(v\d+\.\d+|Note: )/;

/**
 * Transcribes the chart: each Fanatic colour and each of its suggestions is a
 * row, keyed by the label of its slot and its name (`GW/Corax White`), and
 * each suggestion is an equivalence from the Fanatic colour. The colours go
 * in the chart's reading order, column by column.
 */
export function transcribeFanaticChart(
  pdf: PdfText,
): Result<Transcription, readonly string[]> {
  const [page, ...rest] = pdf;
  if (page === undefined || rest.length > 0) {
    return err([`Expected one page, got ${String(pdf.length)}`]);
  }
  const items = textItems(page);
  const names = items.filter(
    (item) => item.size === NAME_SIZE && !FOOTER.test(item.text),
  );
  const suggestions = items.filter((item) => item.size === SLOT_SIZE);

  const chart = chartCollector();
  const used = new Set<PdfTextItem>();
  const inOrder = [...names].sort((a, b) => a.x - b.x || a.y - b.y);
  for (const name of inOrder) {
    const fanatic = chart.paint({
      key: `${FANATIC.label}/${name.text.trim()}`,
      group: FANATIC.group,
      name: name.text.trim(),
      code: null,
    });
    for (const slot of SLOTS) {
      const found = suggestions.filter(
        (item) =>
          near(item.x, name.x, 1.5) && near(item.y - name.y, slot.offset, 1),
      );
      if (found.length > 1) {
        chart.issue(`"${name.text}": ${slot.label} has more than one name`);
      }
      const [suggestion] = found;
      if (suggestion === undefined) continue;
      used.add(suggestion);
      const key = chart.paint({
        key: `${slot.label}/${suggestion.text.trim()}`,
        group: slot.group,
        name: suggestion.text.trim(),
        code: null,
      });
      chart.equivalence(fanatic, key);
    }
  }
  for (const item of suggestions) {
    if (!used.has(item)) {
      chart.issue(
        `"${item.text}" at (${String(item.x)}, ${String(item.y)}) is in no slot of any colour`,
      );
    }
  }
  return chart.result();
}

/** How the rows of each slot of the chart find their curated paint. */
export const FANATIC_CHART_KEYS: KeyRules = {
  "Warpaints Fanatic": {
    brandId: "the-army-painter",
    rangeIds: ["the-army-painter/warpaints-fanatic"],
    by: "name",
  },
  "Original Warpaints": {
    brandId: "the-army-painter",
    rangeIds: ["the-army-painter/warpaints"],
    by: "name",
  },
  "Citadel by Games Workshop": CITADEL_BY_NAME,
};
