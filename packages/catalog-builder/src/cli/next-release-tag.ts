/**
 * Prints the tag of a release published today, in UTC (ADR-0028): the CD to
 * production creates it once the new version is served.
 *
 *   pnpm --filter @chromatic-wheel/catalog-builder --silent next-release-tag
 */
import { nextRelease } from "../index.ts";
import { releaseTags } from "./published-catalog.ts";

const tags = await releaseTags();
const next = tags.ok
  ? nextRelease(tags.value, new Date().toISOString().slice(0, 10))
  : tags;
if (next.ok) {
  console.log(next.value);
} else {
  console.error(next.error.join("\n"));
  process.exitCode = 1;
}
