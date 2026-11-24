/**
 * Reads the text of a PDF with pdf.js, the reader of Firefox (ADR-0033), for
 * the chart importers. Only the text and its positions: nothing is rendered.
 */
import type { PdfPage, PdfText } from "../index.ts";

/**
 * pdf.js, loaded once. On loading, it warns that it cannot render without its
 * native canvas, which this project leaves out on purpose
 * (`ignoredOptionalDependencies`); those warnings, and only those, are muted.
 */
async function loadPdfJs() {
  const warn = console.warn;
  console.warn = (...args: unknown[]) => {
    const [first] = args;
    if (
      typeof first === "string" &&
      /^Warning: Cannot (load|polyfill) /.test(first)
    ) {
      return;
    }
    warn(...args);
  };
  try {
    return await import("pdfjs-dist/legacy/build/pdf.mjs");
  } finally {
    console.warn = warn;
  }
}

/** Two decimals: enough for a layout in points, and stable between runs. */
const round = (value: number): number => Math.round(value * 100) / 100;

export async function readPdfText(bytes: Uint8Array): Promise<PdfText> {
  const { getDocument, VerbosityLevel } = await loadPdfJs();
  const task = getDocument({
    data: bytes,
    verbosity: VerbosityLevel.ERRORS,
    useSystemFonts: false,
  });
  try {
    const document = await task.promise;
    const pages: PdfPage[] = [];
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const { width, height } = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items = content.items.flatMap((item) => {
        if (!("str" in item)) return [];
        const [, , , , x = 0, y = 0] = item.transform as number[];
        return [
          {
            text: item.str,
            x: round(x),
            y: round(height - y),
            width: round(item.width),
            size: round(item.height),
          },
        ];
      });
      pages.push({ width: round(width), height: round(height), items });
    }
    return pages;
  } finally {
    await task.destroy();
  }
}
