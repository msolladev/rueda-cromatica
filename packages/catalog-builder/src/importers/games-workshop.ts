/**
 * Importers of the old documents of Games Workshop that prove which paints
 * each discontinued Citadel line had (ADR-0035): the paints and inks
 * checklist of 2004 and the Foundation and Washes pages of its website of
 * 2008. Their original URLs are gone; `cli/source-files.ts` reads them from their
 * captures in the Wayback Machine. None gives a colour. Pure: each receives
 * the file already read.
 */
import { err, ok, type Result } from "@chromatic-wheel/domain";
import type { SourceRow } from "../curated/files.ts";
import { chartCollector } from "./chart.ts";
import { textItems, type PdfText } from "./pdf-text.ts";
import type { ProposalRules } from "./reconcile.ts";

const rowsOf = (
  result: ReturnType<ReturnType<typeof chartCollector>["result"]>,
): Result<readonly SourceRow[], readonly string[]> =>
  result.ok ? ok(result.value.paints) : result;

// ── The paints and inks checklist of 2004 ────────────────────

/** Its only group: the checklist has five columns, without headings. */
export const CHECKLIST_GROUP = "Paints & Inks Range Checklist";
const CHECKLIST_TITLE = "PAINTS & INKS RANGE CHECKLIST";
/** The name of each pot, and its code, in a smaller size on its right. */
const CHECKLIST_NAME_SIZE = 8;
const CHECKLIST_CODE_SIZE = 5;
const CHECKLIST_CODE = /^61-\d{2}$/;
/** How far right of its name, in points, the code of a pot can be. */
const CHECKLIST_CODE_REACH = 80;

/**
 * Transcribes the checklist card «Paints & Inks Range Checklist»: each pot
 * with its code, keyed by the code (`61-32`), in reading order, column by
 * column. Fails if a name has no code on its right, or a code no name.
 */
export function transcribeChecklist2004(
  pdf: PdfText,
): Result<readonly SourceRow[], readonly string[]> {
  const [page, ...rest] = pdf;
  if (page === undefined || rest.length > 0) {
    return err([`Expected one page, got ${String(pdf.length)}`]);
  }
  const items = textItems(page);
  if (!items.some((item) => item.text.trim() === CHECKLIST_TITLE)) {
    return err([`No title "${CHECKLIST_TITLE}"`]);
  }
  const names = items.filter((item) => item.size === CHECKLIST_NAME_SIZE);
  const codes = items.filter((item) => item.size === CHECKLIST_CODE_SIZE);

  const chart = chartCollector();
  const used = new Set<(typeof codes)[number]>();
  const columns = [...names].sort(
    (a, b) => Math.round(a.x) - Math.round(b.x) || a.y - b.y,
  );
  for (const name of columns) {
    const text = name.text.trim();
    const found = codes.filter(
      (code) =>
        Math.abs(code.y - name.y) < 1 &&
        code.x > name.x &&
        code.x - name.x < CHECKLIST_CODE_REACH,
    );
    const [code, ...others] = found;
    if (code === undefined || others.length > 0) {
      chart.issue(`"${text}": expected one code on its right`);
      continue;
    }
    const literal = code.text.trim();
    if (!CHECKLIST_CODE.test(literal)) {
      chart.issue(`"${text}": unexpected code "${literal}"`);
      continue;
    }
    used.add(code);
    chart.paint({
      key: literal,
      group: CHECKLIST_GROUP,
      name: text,
      code: literal,
    });
  }
  for (const code of codes) {
    if (!used.has(code)) chart.issue(`Code "${code.text}" without a name`);
  }
  return rowsOf(chart.result());
}

// ── The pages of the website of 2008 ─────────────────────────

const ATTRIBUTE = (name: string): RegExp => new RegExp(`\\b${name}="([^"]*)"`);

/** The `src` and `alt` of every image of an HTML page, in its order. */
function images(html: string): readonly { src: string; alt: string }[] {
  return [...html.matchAll(/<img\b[^>]*>/gi)].map(([tag]) => ({
    src: ATTRIBUTE("src").exec(tag)?.[1] ?? "",
    alt: ATTRIBUTE("alt").exec(tag)?.[1] ?? "",
  }));
}

/** The entities of the `alt` texts of these pages. */
const decode = (text: string): string =>
  text
    .replaceAll("&#39;", "'")
    .replaceAll("&#38;", "&")
    .replaceAll("&amp;", "&");

/**
 * The paints of a page: the images whose `src` matches, each named by its
 * `alt`, keyed by that name. Fails if there is none, or one has no name.
 */
function paintImages(
  html: string,
  src: RegExp,
  group: string,
): Result<readonly SourceRow[], readonly string[]> {
  const chart = chartCollector();
  const found = images(html).filter((image) => src.test(image.src));
  if (found.length === 0) return err([`No image matches ${String(src)}`]);
  for (const image of found) {
    const name = decode(image.alt).trim();
    if (name === "") {
      chart.issue(`Image ${image.src} without a name`);
      continue;
    }
    chart.paint({ key: name, group, name, code: null });
  }
  return rowsOf(chart.result());
}

export const FOUNDATION_GROUP = "Citadel Foundation Paints";

/**
 * Transcribes «What Are Citadel Foundation Paints?» (2008): the swatch of
 * each paint, an image named after it, in the order of the page.
 */
export const transcribeFoundationPage = (
  html: string,
): Result<readonly SourceRow[], readonly string[]> =>
  paintImages(
    html,
    /^\/library\/foundationpaints\/[^/]+\.jpg$/,
    FOUNDATION_GROUP,
  );

export const WASHES_GROUP = "Citadel Washes";

/**
 * Transcribes the gallery of «Using the New Citadel Washes» (2008, page 4):
 * the picture of each wash, named after it, in the order of the page.
 */
export const transcribeWashesPage = (
  html: string,
): Result<readonly SourceRow[], readonly string[]> =>
  paintImages(html, /^\/painting\/washes\/images\/[a-z_]+\.jpg$/, WASHES_GROUP);

// ── Where their paints go ────────────────────────────────────

/**
 * How the new rows of these documents become proposed paints (ADR-0013,
 * ADR-0035): each document proves one line, which is one range. The inks and
 * the metallics of the checklist, which its group does not tell apart, are
 * corrected in their curated files, with a note.
 */
export const GAMES_WORKSHOP_RULES: ProposalRules = {
  groups: {
    [CHECKLIST_GROUP]: {
      rangeId: "citadel/citadel-colour",
      type: "standard",
      metallic: false,
    },
    [FOUNDATION_GROUP]: {
      rangeId: "citadel/foundation",
      type: "base",
      metallic: false,
    },
    [WASHES_GROUP]: {
      rangeId: "citadel/washes",
      type: "wash",
      metallic: false,
    },
  },
};
