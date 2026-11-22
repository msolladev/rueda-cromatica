/**
 * The text of a PDF with its positions, as the chart transcribers receive it
 * (ADR-0033). `cli/pdf.ts` reads it from the file; the transcribers stay pure.
 */

/** A piece of text as the PDF draws it. */
export interface PdfTextItem {
  readonly text: string;
  /** From the left edge of the page to the start of the text, in points. */
  readonly x: number;
  /** From the top edge of the page to the baseline of the text, in points. */
  readonly y: number;
  readonly width: number;
  /** The font size, in points. */
  readonly size: number;
}

export interface PdfPage {
  readonly width: number;
  readonly height: number;
  readonly items: readonly PdfTextItem[];
}

export type PdfText = readonly PdfPage[];

/**
 * The items that carry text, once each: without the empty ones and without
 * exact repetitions (the same text at the same place), which some charts
 * draw twice for a bolder look.
 */
export function textItems(page: PdfPage): readonly PdfTextItem[] {
  const seen = new Set<string>();
  return page.items.filter((item) => {
    if (item.text.trim() === "") return false;
    const id = `${item.text}\n${String(item.x)}\n${String(item.y)}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** The literal text of a cell: its lines joined by a space, trimmed. */
export const cellText = (items: readonly PdfTextItem[]): string =>
  items
    .map((item) => item.text.trim())
    .join(" ")
    .replace(/\s+/g, " ");

/** Whether two positions are the same, within the given tolerance. */
export const near = (a: number, b: number, tolerance: number): boolean =>
  Math.abs(a - b) <= tolerance;
