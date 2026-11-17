/**
 * Imports one brand from DonnervS/miniature-paints into
 * `data/brands/<brand-id>.json` (docs/04 §4). Run on demand, never in the CI:
 *
 *   pnpm --filter @chromatic-wheel/catalog-builder import-donnervs <brand-id>
 *
 * The file is fetched at the commit pinned in the source's `url`.
 */
import { err } from "@chromatic-wheel/domain";
import { DONNERVS_BRANDS, importDonnervS } from "../importers/donnervs.ts";
import { rawUrl, runImport } from "./run-import.ts";

const brandId = process.argv[2] ?? "";
const brand = DONNERVS_BRANDS[brandId];

if (brand === undefined) {
  console.error(
    `Usage: import-donnervs <brand-id>, one of: ${Object.keys(DONNERVS_BRANDS).join(", ")}`,
  );
  process.exitCode = 1;
} else {
  process.exitCode = await runImport({
    sourceId: "donnervs-miniature-paints",
    brandId,
    fileUrl: (pinned) => rawUrl(pinned, brand.file),
    read: (text, sourceId) => {
      try {
        return importDonnervS(JSON.parse(text), brand, sourceId);
      } catch (error) {
        return err([`Invalid JSON: ${String(error)}`]);
      }
    },
  });
}
